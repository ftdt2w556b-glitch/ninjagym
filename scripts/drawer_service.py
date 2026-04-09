#!/usr/bin/env python3
"""
NinjaGym Cash Drawer Service — BT-100U edition
=============================================
Polls Supabase drawer_log and opens the cash drawer via the BT-100U
USB trigger (appears as a virtual COM/serial port).
Also serves an HTTP bridge on localhost:3001 so the Next.js POS page
can trigger the drawer directly without waiting for a poll cycle.

Requirements:
    pip install pyserial

Usage:
    python3 drawer_service.py

Port override (edit SERIAL_PORT below if auto-detect picks the wrong device):
    Mac:     /dev/tty.usbserial-XXXXXXXX
    Linux:   /dev/ttyUSB0
    Windows: COM3
"""
import time
import json
import threading
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler

try:
    import serial
    SERIAL_OK = True
except ImportError:
    print("ERROR: pyserial not installed. Run:  pip install pyserial")
    SERIAL_OK = False

# list_ports doesn't work on Android — catch separately
try:
    import serial.tools.list_ports
    HAS_LIST_PORTS = True
except (ImportError, Exception):
    HAS_LIST_PORTS = False

# ── Configuration ─────────────────────────────────────────────────────────────

SUPABASE_URL = "https://bwyprymiykkquszkjkje.supabase.co"
SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3"
    "eXByeW1peWtrcXVzemtqa2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2"
    "MjM0NzQsImV4cCI6MjA5MDE5OTQ3NH0"
    "._-kSPcDHu2TWO8Uj2cTrk81ySUV6eCfY9VmLnFFyKbc"
)

POLL_INTERVAL = 2    # seconds between Supabase polls
HTTP_PORT     = 3001 # must match BRIDGE_URL in lib/pos/bridge.ts

# ESC/POS cash drawer kick — Epson-style
# ESC p <pin> <on_ms/2> <off_ms/2>
# BT-100U supports both pin 2 (0x00) and pin 1 (0x01); send both to be safe.
DRAWER_CMD_P2 = bytes([0x1B, 0x70, 0x00, 0x19, 0xFA])  # pin 2
DRAWER_CMD_P1 = bytes([0x1B, 0x70, 0x01, 0x19, 0xFA])  # pin 1

# Set to a fixed port string to skip auto-detection, e.g.:
#   SERIAL_PORT = "/dev/tty.usbserial-A50285BI"
#   SERIAL_PORT = "COM3"
SERIAL_PORT = None   # None = auto-detect on every open attempt

# ── Serial / drawer ───────────────────────────────────────────────────────────

def find_port():
    """Auto-detect the BT-100U virtual COM port."""
    import os
    if HAS_LIST_PORTS:
        ports = list(serial.tools.list_ports.comports())
        usb_keywords = ("usb", "serial", "cp210", "ch340", "ch341", "ft232", "prolific")
        for p in ports:
            desc = (p.description or "").lower()
            if any(k in desc for k in usb_keywords):
                return p.device
        return ports[0].device if ports else None
    else:
        # Android fallback — try common port names in order
        candidates = (
            [f"/dev/ttyUSB{i}" for i in range(4)] +
            [f"/dev/ttyACM{i}" for i in range(4)]
        )
        for p in candidates:
            if os.path.exists(p):
                return p
        return None


def open_drawer():
    """Send ESC/POS kick bytes to the BT-100U via pyserial."""
    if not SERIAL_OK:
        print("Cannot open drawer — pyserial not installed.")
        return False

    port = SERIAL_PORT or find_port()
    if not port:
        print("Drawer error: No COM port found. Is the BT-100U plugged in?")
        return False

    try:
        with serial.Serial(port, baudrate=9600, timeout=1) as ser:
            ser.write(DRAWER_CMD_P2)
            ser.write(DRAWER_CMD_P1)
            ser.flush()
        print(f"  ✓ Drawer opened via {port}")
        return True
    except Exception as exc:
        print(f"  ✗ Drawer error on {port}: {exc}")
        return False

# ── HTTP bridge ───────────────────────────────────────────────────────────────
# The Next.js bridge (lib/pos/bridge.ts) calls POST /open-drawer on localhost:3001
# when the RawBT WebSocket is not available.

class BridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # suppress default access log noise

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path in ("/open-drawer", "/open-drawer/"):
            ok = open_drawer()
            body = json.dumps({"ok": ok}).encode()
            self.send_response(200 if ok else 500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()


def start_http_server():
    server = HTTPServer(("127.0.0.1", HTTP_PORT), BridgeHandler)
    print(f"HTTP bridge listening → http://127.0.0.1:{HTTP_PORT}/open-drawer")
    server.serve_forever()

# ── Supabase polling ──────────────────────────────────────────────────────────

def supabase_get(path):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        },
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


def main():
    global last_id
    last_id = 0

    print("=" * 52)
    print("  NinjaGym Drawer Service  (BT-100U)")
    print("=" * 52)

    # List available serial ports at startup
    if not SERIAL_OK:
        print("WARNING: pyserial missing — run:  pip install pyserial")
    elif HAS_LIST_PORTS:
        ports = list(serial.tools.list_ports.comports())
        if ports:
            print("Available serial ports:")
            for p in ports:
                print(f"  {p.device:<25} {p.description}")
        else:
            print("WARNING: No serial ports detected. Check BT-100U connection.")
    else:
        detected = find_port()
        if detected:
            print(f"Port detected (Android): {detected}")
        else:
            print("WARNING: No serial port found at /dev/ttyUSB0-3 or /dev/ttyACM0-3")

    # Start HTTP bridge in a daemon thread
    threading.Thread(target=start_http_server, daemon=True).start()

    # Seed last_id so we don't replay old entries on restart
    try:
        rows = supabase_get("drawer_log?select=id&order=id.desc&limit=1")
        if rows:
            last_id = rows[0]["id"]
        print(f"Polling drawer_log from ID {last_id}")
    except Exception as exc:
        print(f"Warning (seed): {exc}")

    print("Ready — polling Supabase every 2 s ...\n")

    while True:
        try:
            rows = supabase_get(
                f"drawer_log?id=gt.{last_id}&select=id,reason&order=id.asc&limit=10"
            )
            if rows:
                last_id = rows[-1]["id"]
                reason = rows[-1].get("reason") or "unknown"
                print(f"drawer_log #{last_id}  reason={reason} → opening drawer ...")
                open_drawer()
        except Exception as exc:
            print(f"Poll error: {exc}")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()

"use client";

import { SaleData } from "@/types";

// ── Drawer command ────────────────────────────────────────────────────────────
// ESC p m t1 t2  (XP-58 confirmed: pin 2, pulse 25/250 ms)
const DRAWER_CMD = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);

const RAWBT_WS   = "ws://localhost:40213";  // Server for RawBT companion app
const BRIDGE_URL = process.env.NEXT_PUBLIC_PRINTER_BRIDGE_URL ?? "http://localhost:3001";

/**
 * Send raw ESC/POS bytes via the "Server for RawBT" WebSocket (port 40213).
 * Returns true if the socket opened and the bytes were sent successfully.
 */
function sendViaRawBT(bytes: Uint8Array): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(RAWBT_WS);
      ws.binaryType = "arraybuffer";
      const timer = setTimeout(() => { ws.close(); resolve(false); }, 3000);
      ws.onopen = () => {
        ws.send(bytes);
        clearTimeout(timer);
        ws.close();
        resolve(true);
      };
      ws.onerror = () => { clearTimeout(timer); resolve(false); };
    } catch {
      resolve(false);
    }
  });
}

/**
 * Open the cash drawer.
 * Tries RawBT WebSocket first, falls back to the localhost:3001 bridge.
 */
async function triggerDrawer(): Promise<boolean> {
  // 1. Try direct WebSocket to "Server for RawBT" (no extra server needed)
  const rawbt = await sendViaRawBT(DRAWER_CMD);
  if (rawbt) return true;

  // 2. Fall back to existing HTTP bridge (localhost:3001)
  try {
    const res = await fetch(`${BRIDGE_URL}/open-drawer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function openDrawerAndPrint(saleData: SaleData): Promise<boolean> {
  // Open drawer immediately via RawBT / bridge
  const drawerOk = await triggerDrawer();

  // Also attempt receipt print via HTTP bridge (non-blocking if bridge absent)
  fetch(`${BRIDGE_URL}/print-receipt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(saleData),
    signal: AbortSignal.timeout(4000),
  }).catch(() => {});

  return drawerOk;
}

export async function openDrawerOnly(_employee: string): Promise<boolean> {
  return triggerDrawer();
}

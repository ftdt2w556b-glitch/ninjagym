"use client";

import { SaleData } from "@/types";

const BRIDGE_URL = process.env.NEXT_PUBLIC_PRINTER_BRIDGE_URL ?? "http://localhost:3001";

// ESC/POS cash drawer kick — pin 2 then pin 1 (BT-100U compatible)
const DRAWER_BYTES = new Uint8Array([
  0x1b, 0x70, 0x00, 0x19, 0xfa, // pin 2
  0x1b, 0x70, 0x01, 0x19, 0xfa, // pin 1
]);

// Also try a minimal single-byte trigger that some cheap triggers respond to
const DRAWER_BYTES_SIMPLE = new Uint8Array([0x00]);

// ── Web Serial API ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendToPort(port: any): Promise<boolean> {
  try {
    if (port.readable || port.writable) {
      // Port may already be open from a previous call — close it first
      try { await port.close(); } catch { /* ignore */ }
    }
    await port.open({ baudRate: 9600 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const writer = (port.writable as any).getWriter();
    await writer.write(DRAWER_BYTES);
    // Also send the simple trigger — some BT-100U units need just a single byte
    await writer.write(DRAWER_BYTES_SIMPLE);
    writer.releaseLock();
    await port.close();
    return true;
  } catch (e) {
    console.error("Web Serial send error:", e);
    return false;
  }
}

/** Force the user to pick a port — call this from a setup/config button. */
export async function selectDrawerPort(): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serial = (navigator as any).serial;
  if (!serial) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const port: any = await serial.requestPort(); // always shows picker
    return await sendToPort(port);
  } catch (e) {
    console.error("Port selection cancelled or failed:", e);
    return false;
  }
}

async function triggerViaWebSerial(): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serial = (navigator as any).serial;
  if (!serial) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ports: any[] = await serial.getPorts();
    if (ports.length === 0) {
      // No port granted yet — show picker (requires user gesture, button click qualifies)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const port: any = await serial.requestPort();
      return await sendToPort(port);
    }
    // Try each granted port — first one that succeeds wins
    for (const port of ports) {
      if (await sendToPort(port)) return true;
    }
    return false;
  } catch (e) {
    console.error("Web Serial drawer error:", e);
    return false;
  }
}

// ── HTTP bridge fallback (drawer_service.py on localhost:3001) ────────────────
async function triggerViaHttpBridge(): Promise<boolean> {
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

async function triggerDrawer(): Promise<boolean> {
  if (await triggerViaWebSerial()) return true;
  return triggerViaHttpBridge();
}

export async function openDrawerAndPrint(saleData: SaleData): Promise<boolean> {
  const drawerOk = await triggerDrawer();
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

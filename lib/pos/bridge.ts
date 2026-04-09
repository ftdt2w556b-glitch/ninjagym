"use client";

import { SaleData } from "@/types";

const BRIDGE_URL = process.env.NEXT_PUBLIC_PRINTER_BRIDGE_URL ?? "http://localhost:3001";

// ESC/POS cash drawer kick — pin 2 then pin 1 (BT-100U compatible)
const DRAWER_BYTES = new Uint8Array([
  0x1b, 0x70, 0x00, 0x19, 0xfa, // pin 2
  0x1b, 0x70, 0x01, 0x19, 0xfa, // pin 1
]);

// ── Web Serial API (Chrome built-in, no Python/Termux needed) ─────────────────
async function triggerViaWebSerial(): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serial = (navigator as any).serial;
  if (!serial) return false;
  try {
    // Use a port the user already granted; if none, show the port picker.
    // (requestPort requires a user gesture — the "Open Drawer" button provides it.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ports: any[] = await serial.getPorts();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const port: any = ports[0] ?? (await serial.requestPort());
    await port.open({ baudRate: 9600 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const writer = (port.writable as any).getWriter();
    await writer.write(DRAWER_BYTES);
    writer.releaseLock();
    await port.close();
    return true;
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

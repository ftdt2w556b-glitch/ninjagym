"use client";

import { SaleData } from "@/types";

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_PRINTER_BRIDGE_URL ?? "http://localhost:3001";

export async function openDrawerAndPrint(saleData: SaleData): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_URL}/print-receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(saleData),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    // Bridge unavailable; sale is already saved in Supabase
    return false;
  }
}

export async function openDrawerOnly(employee: string): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_URL}/open-drawer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee }),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

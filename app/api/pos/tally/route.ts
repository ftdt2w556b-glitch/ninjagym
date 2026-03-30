import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/pos/tally
 * Returns today's POS cash breakdown: total, drawer (sub-1K), box (1K notes).
 */
export async function GET() {
  try {
    const admin = createAdminClient();
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await admin
      .from("cash_sales")
      .select("amount, notes_1k")
      .gte("processed_at", `${today}T00:00:00`)
      .lte("processed_at", `${today}T23:59:59`);

    if (error) throw error;

    const total     = (data ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const boxTotal  = (data ?? []).reduce((s, r) => s + (Number(r.notes_1k ?? 0) * 1000), 0);
    const drawerTotal = total - boxTotal;
    const count     = (data ?? []).length;

    return NextResponse.json({ total, drawerTotal, boxTotal, count });
  } catch (err: unknown) {
    console.error("GET /api/pos/tally error:", err);
    return NextResponse.json({ total: 0, drawerTotal: 0, boxTotal: 0, count: 0 });
  }
}

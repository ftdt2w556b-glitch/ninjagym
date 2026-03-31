import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { bangkokStartOfDay, bangkokEndOfDay } from "@/lib/timezone";

/**
 * GET /api/pos/tally
 * Returns today's POS cash breakdown: total, drawer (sub-1K), box (1K notes).
 */
export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("cash_sales")
      .select("id, amount")
      .gte("processed_at", bangkokStartOfDay())
      .lte("processed_at", bangkokEndOfDay());

    if (error) throw error;

    const total = (data ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const count = (data ?? []).length;

    // notes_1k is a newer column — fetch separately to avoid breaking tally if column missing
    let boxTotal = 0;
    const ids = (data ?? []).map((r) => r.id as number);
    if (ids.length > 0) {
      const { data: notesRows } = await admin
        .from("cash_sales")
        .select("notes_1k")
        .in("id", ids);
      boxTotal = (notesRows ?? []).reduce((s, r) => s + (Number(r.notes_1k ?? 0) * 1000), 0);
    }

    const drawerTotal = total - boxTotal;

    return NextResponse.json({ total, drawerTotal, boxTotal, count });
  } catch (err: unknown) {
    console.error("GET /api/pos/tally error:", err);
    return NextResponse.json({ total: 0, drawerTotal: 0, boxTotal: 0, count: 0 });
  }
}

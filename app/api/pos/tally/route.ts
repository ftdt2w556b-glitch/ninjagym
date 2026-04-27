import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { bangkokToday, bangkokStartOfDay, bangkokEndOfDay } from "@/lib/timezone";

/**
 * GET /api/pos/tally
 * Returns today's POS cash breakdown: total, drawer (sub-1K), box (1K notes).
 */
export async function GET() {
  try {
    const admin = createAdminClient();
    const [{ data, error }, { data: removedSetting }, { data: removedDateSetting }, { data: floatSetting }, { data: expectedSetting }, { data: expectedDateSetting }] = await Promise.all([
      admin
        .from("cash_sales")
        .select("id, amount")
        .gte("processed_at", bangkokStartOfDay())
        .lte("processed_at", bangkokEndOfDay()),
      admin.from("settings").select("value").eq("key", "drawer_removed").maybeSingle(),
      admin.from("settings").select("value").eq("key", "drawer_removed_date").maybeSingle(),
      admin.from("settings").select("value").eq("key", "drawer_float").maybeSingle(),
      admin.from("settings").select("value").eq("key", "drawer_expected").maybeSingle(),
      admin.from("settings").select("value").eq("key", "drawer_expected_date").maybeSingle(),
    ]);

    if (error) throw error;

    const total = (data ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const count = (data ?? []).length;

    // Only use drawer_removed if it was recorded today (Bangkok time) — auto-resets each day
    const today = bangkokToday();
    const removedDate = removedDateSetting?.value ?? "";
    const removed = (removedDate === today && removedSetting?.value)
      ? parseInt(removedSetting.value, 10)
      : 0;

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
    const float = floatSetting?.value ? parseInt(floatSetting.value, 10) : 3000;
    // Only use drawer_expected override if it was set today — auto-resets each day like drawer_removed
    const expectedDate = expectedDateSetting?.value ?? "";
    const expectedOverride = (expectedDate === today && expectedSetting?.value && expectedSetting.value !== "")
      ? parseInt(expectedSetting.value, 10)
      : null;

    return NextResponse.json({ total, drawerTotal, boxTotal, count, removed, float, expectedOverride });
  } catch (err: unknown) {
    console.error("GET /api/pos/tally error:", err);
    return NextResponse.json({ total: 0, drawerTotal: 0, boxTotal: 0, count: 0, removed: 0, float: 3000 });
  }
}

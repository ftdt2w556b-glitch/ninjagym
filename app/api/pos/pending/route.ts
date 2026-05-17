import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

async function isPosUnlocked() {
  const cookieStore = await cookies();
  const posAuth = cookieStore.get("pos_auth")?.value;
  if (!posAuth) return false;
  const admin = createAdminClient();
  const { data } = await admin.from("settings").select("value").eq("key", "pos_password").maybeSingle();
  const expected = data?.value ?? process.env.POS_PASSWORD ?? null;
  return expected ? posAuth === expected : posAuth === "unlocked";
}

/**
 * GET /api/pos/pending
 * Returns every cash-pending row staff can approve from the tablet:
 *   • member_registrations.cash_pending (session / top-up cash buys)
 *   • shop_orders.cash_pending          (water, t-shirts, etc.)
 *
 * Output shape matches PendingReg in PosScreen. The `source` discriminator
 * routes the on-tap behaviour:
 *   source='member' → build a single-line cart with the program label
 *   source='shop'   → build cart lines from order.items so inventory
 *                     decrement + slip flip run for each line
 *
 * Mirrors the merge done at page load in /app/pos/page.tsx — without this
 * the live poll wipes shop orders off the queue every refresh.
 */
export async function GET() {
  if (!(await isPosUnlocked())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const admin = createAdminClient();
    const [{ data: members }, { data: shopRows }] = await Promise.all([
      admin
        .from("member_registrations")
        .select("id, name, membership_type, amount_paid, kids_names, notes, created_at")
        .eq("slip_status", "cash_pending")
        .order("created_at", { ascending: true }),
      admin
        .from("shop_orders")
        .select("id, name, total_amount, items, notes, created_at")
        .eq("slip_status", "cash_pending")
        .order("created_at", { ascending: true }),
    ]);

    const merged = [
      ...((members ?? []).map((r) => ({
        id:              r.id as number,
        name:            (r.name as string | null) ?? "",
        membership_type: (r.membership_type as string | null) ?? "",
        amount_paid:     Number(r.amount_paid ?? 0),
        kids_names:      (r.kids_names as string | null) ?? null,
        notes:           (r.notes as string | null) ?? null,
        created_at:      r.created_at as string,
        source:          "member" as const,
      }))),
      ...((shopRows ?? []).map((r) => ({
        id:              r.id as number,
        name:            (r.name as string | null) ?? "Shop order",
        membership_type: "shop",
        amount_paid:     Number(r.total_amount ?? 0),
        kids_names:      null,
        notes:           (r.notes as string | null) ?? null,
        created_at:      r.created_at as string,
        source:          "shop" as const,
        items:           r.items,
      }))),
    ].sort((a, b) => a.created_at.localeCompare(b.created_at));

    return NextResponse.json(merged);
  } catch {
    return NextResponse.json([]);
  }
}

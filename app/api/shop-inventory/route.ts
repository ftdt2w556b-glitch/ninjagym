import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * PATCH /api/shop-inventory
 * Body: { item_id, variant?, delta? } — increment/decrement by delta
 *    or { item_id, variant?, set_qty } — set an absolute quantity
 */
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { item_id, variant = "", delta, set_qty } = body;

  if (!item_id) {
    return NextResponse.json({ error: "Missing item_id" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (set_qty !== undefined) {
    const qty = Math.max(0, Number(set_qty));
    const { error } = await admin
      .from("shop_inventory")
      .upsert(
        { item_id, variant, stock_qty: qty, updated_at: new Date().toISOString() },
        { onConflict: "item_id,variant" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, stock_qty: qty });
  }

  // Delta update — fetch current first
  const { data: current } = await admin
    .from("shop_inventory")
    .select("stock_qty")
    .eq("item_id", item_id)
    .eq("variant", variant)
    .maybeSingle();

  const newQty = Math.max(0, (current?.stock_qty ?? 0) + Number(delta ?? 0));

  const { error } = await admin
    .from("shop_inventory")
    .upsert(
      { item_id, variant, stock_qty: newQty, updated_at: new Date().toISOString() },
      { onConflict: "item_id,variant" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, stock_qty: newQty });
}

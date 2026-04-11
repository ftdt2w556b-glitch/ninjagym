import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/water-addon
 * Body: { qty, member_name?, reference_id?, payment_method? }
 *
 * Decrements inventory and records a shop cash_sale (cash only).
 * For PromptPay/Stripe, water is already included in the member registration
 * amount — no separate cash_sale is created to avoid double-counting.
 */
export async function POST(request: NextRequest) {
  try {
    const { qty, member_name, reference_id, payment_method } = await request.json();
    const waterQty = Math.max(0, Math.min(10, Number(qty) || 0));
    if (waterQty === 0) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const WATER_PRICE = 15;
    const amount = waterQty * WATER_PRICE;
    const admin = createAdminClient();

    // Only record a separate cash_sale for cash payments.
    // PromptPay/Stripe water is already baked into the registration total.
    const isCash = !payment_method || payment_method === "cash";
    if (isCash) {
      const { error: saleErr } = await admin.from("cash_sales").insert({
        sale_type: "shop",
        reference_id: reference_id ?? null,
        amount,
        items: [{ item_id: "water", name: "Water", qty: waterQty, variant: "Regular", unit_price: WATER_PRICE }],
        staff_name: "Registration add-on",
        drawer_opened: false,
        receipt_printed: false,
        notes: member_name ? `Water add-on for ${member_name}` : "Water add-on from registration",
      });
      if (saleErr) console.error("Water sale insert error:", saleErr);
    }

    // Always decrement shop inventory regardless of payment method
    const { data: current } = await admin
      .from("shop_inventory")
      .select("stock_qty")
      .eq("item_id", "water")
      .eq("variant", "Regular")
      .maybeSingle();

    if (current) {
      const newQty = Math.max(0, (current.stock_qty ?? 0) - waterQty);
      await admin.from("shop_inventory").upsert(
        { item_id: "water", variant: "Regular", stock_qty: newQty, updated_at: new Date().toISOString() },
        { onConflict: "item_id,variant" }
      );
    }

    return NextResponse.json({ success: true, amount });
  } catch (err: unknown) {
    console.error("POST /api/water-addon error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

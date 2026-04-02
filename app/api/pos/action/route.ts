import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    // POS runs as a kiosk (no admin login) — verify pos_auth cookie instead
    const cookieStore = await cookies();
    const posAuth = cookieStore.get("pos_auth")?.value;
    const admin = createAdminClient();
    const { data: pwSetting } = await admin.from("settings").select("value").eq("key", "pos_password").maybeSingle();
    const expected = pwSetting?.value ?? process.env.POS_PASSWORD ?? null;
    const isUnlocked = expected ? posAuth === expected : posAuth === "unlocked";
    if (!isUnlocked) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { action, staffId, staffType, staffName, amount, amountTendered, changeGiven, saleType, referenceId, items, notes, reason, notes1k } = body;

    if (!staffId) {
      return NextResponse.json({ error: "staffId required" }, { status: 400 });
    }

    if (action === "cash_sale") {
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }

      // Insert cash sale
      const salePayload: Record<string, unknown> = {
        sale_type: saleType ?? "walkin",
        reference_id: referenceId ?? null,
        amount,
        items: items ?? null,
        processed_by: staffType === "profile" ? staffId : null,
        staff_name: staffName ?? null,
        drawer_opened: true,
        receipt_printed: false,
        notes: notes ?? null,
      };
      if (typeof notes1k === "number") salePayload.notes_1k = notes1k;
      if (amountTendered != null) salePayload.amount_tendered = Number(amountTendered);
      if (changeGiven != null)    salePayload.change_given    = Number(changeGiven);

      const { data: sale, error: saleError } = await admin
        .from("cash_sales")
        .insert(salePayload)
        .select("id")
        .single();

      if (saleError) throw saleError;

      // Insert drawer log
      await admin.from("drawer_log").insert({
        opened_by: staffType === "profile" ? staffId : null,
        staff_name: staffName ?? null,
        reason: "cash_sale",
        sale_id: sale.id,
      });

      // Update reference record slip_status to approved if provided
      if (referenceId && saleType === "membership") {
        await admin
          .from("member_registrations")
          .update({ slip_status: "approved", slip_reviewed_at: new Date().toISOString() })
          .eq("id", referenceId);
      }

      // Decrement inventory for physical shop items
      if (saleType === "shop" && Array.isArray(items)) {
        for (const item of items) {
          if (!item.item_id) continue; // skip gift cards / non-inventory items
          const { data: current } = await admin
            .from("shop_inventory")
            .select("stock_qty")
            .eq("item_id", item.item_id)
            .eq("variant", item.variant ?? "")
            .maybeSingle();
          const newQty = Math.max(0, (current?.stock_qty ?? 0) - (item.qty ?? 1));
          await admin.from("shop_inventory").upsert(
            { item_id: item.item_id, variant: item.variant ?? "", stock_qty: newQty, updated_at: new Date().toISOString() },
            { onConflict: "item_id,variant" }
          );
        }
      }

      return NextResponse.json({ saleId: sale.id });
    }

    if (action === "open_drawer") {
      const { error } = await admin.from("drawer_log").insert({
        opened_by: staffType === "profile" ? staffId : null,
        staff_name: staffName ?? null,
        reason: reason ?? "manual_open",
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("POST /api/pos/action error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

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
    const { action, staffId, staffType, staffName, amount, amountTendered, changeGiven, saleType, referenceId, items, notes, reason, notes1k, correctedMembershipType, correctedSessions } = body;

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

      // Approve pending cash membership registration + auto check-in.
      // Parent already chose their program and kids count on their card —
      // POS approval is the single staff action (payment + check-in combined).
      if (referenceId && saleType === "membership") {
        // Fetch registration details for check-in
        const { data: reg } = await admin
          .from("member_registrations")
          .select("name, kids_count, membership_type, sessions_remaining")
          .eq("id", referenceId)
          .single();

        const regUpdate: Record<string, unknown> = {
          slip_status: "approved",
          slip_reviewed_at: new Date().toISOString(),
        };
        let finalType       = reg?.membership_type ?? "";
        let finalSessions   = reg?.sessions_remaining ?? null;
        if (correctedMembershipType) {
          regUpdate.membership_type = correctedMembershipType;
          regUpdate.amount_paid     = amount;
          if (correctedSessions !== undefined) {
            regUpdate.sessions_remaining = correctedSessions;
            finalSessions = correctedSessions;
          }
          finalType = correctedMembershipType;
        }
        await admin.from("member_registrations").update(regUpdate).eq("id", referenceId);

        // Auto check-in: parent is physically here paying cash for today's session
        if (reg) {
          const kidsCount = reg.kids_count ?? 1;
          await admin.from("attendance_logs").insert({
            member_id:       referenceId,
            member_name:     reg.name,
            kids_count:      kidsCount,
            membership_type: finalType,
            notes:           `Check-in by ${staffName ?? "staff"} | ${kidsCount} kid${kidsCount !== 1 ? "s" : ""}`,
            check_in_at:     new Date().toISOString(),
          });
          if (finalSessions !== null) {
            await admin
              .from("member_registrations")
              .update({ sessions_remaining: Math.max(0, finalSessions - kidsCount) })
              .eq("id", referenceId);
          }
        }
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

    // Dismiss a pending cash registration without collecting cash
    // Used when admin already approved the member via another method
    if (action === "dismiss_pending") {
      if (!referenceId) return NextResponse.json({ error: "referenceId required" }, { status: 400 });
      await admin
        .from("member_registrations")
        .update({ slip_status: "approved", slip_reviewed_at: new Date().toISOString() })
        .eq("id", referenceId)
        .eq("slip_status", "cash_pending"); // only dismiss if still pending (safety check)
      return NextResponse.json({ ok: true });
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

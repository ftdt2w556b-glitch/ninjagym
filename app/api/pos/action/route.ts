import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { logStaffAction } from "@/lib/staff-actions";
import type { StaffActor } from "@/lib/staff-pin";

/** Build the StaffActor that staff_actions expects from POS's identity payload. */
function posActor(staffType: string | undefined, staffId: string | undefined, staffName: string | undefined): StaffActor | null {
  if (!staffId || !staffName) return null;
  if (staffType === "pos") {
    const numeric = String(staffId).replace(/^pos:/, "");
    return { kind: "pos_staff", id: numeric, name: staffName };
  }
  if (staffType === "profile") {
    return { kind: "profile", id: String(staffId), name: staffName };
  }
  return null;
}

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    // POS runs as a kiosk (no admin login), verify pos_auth cookie instead
    const cookieStore = await cookies();
    const posAuth = cookieStore.get("pos_auth")?.value;
    const admin = createAdminClient();
    const { data: pwSetting } = await admin.from("settings").select("value").eq("key", "pos_password").maybeSingle();
    const expected = pwSetting?.value ?? process.env.POS_PASSWORD ?? null;
    const isUnlocked = expected ? posAuth === expected : posAuth === "unlocked";
    if (!isUnlocked) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { action, staffId, staffType, staffName, amount, amountTendered, changeGiven, saleType, referenceId, items, notes, reason, notes1k, correctedMembershipType, correctedSessions, customerName, customerTaxId } = body;

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
        notes:            notes          ?? null,
        customer_name:    customerName   ?? null,
        customer_tax_id:  customerTaxId  ?? null,
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
      // Parent already chose their program and kids count on their card -
      // POS approval is the single staff action (payment + check-in combined).
      if (referenceId && saleType === "membership") {
        // Fetch registration details for check-in
        const { data: reg } = await admin
          .from("member_registrations")
          .select("name, kids_count, kids_names, parent_member_id, membership_type, sessions_remaining")
          .eq("id", referenceId)
          .single();

        // Top-ups don't store kids_names, pull from the parent registration.
        let regKidsNames: string | null = (reg?.kids_names as string | null) ?? null;
        if (!regKidsNames && reg?.parent_member_id) {
          const { data: parent } = await admin
            .from("member_registrations")
            .select("kids_names")
            .eq("id", reg.parent_member_id)
            .maybeSingle();
          regKidsNames = (parent?.kids_names as string | null) ?? null;
        }

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

        // Audit log for the dashboard's Approved tab. cash_sales already
        // carries the staff_name for accounting purposes; this row is
        // what AuditAttribution reads to render 'Naing · time' beside
        // the member card on /admin/payments. Best-effort, never blocks.
        const actor = posActor(staffType, staffId, staffName);
        if (actor) {
          await logStaffAction({
            actor,
            actionType:    "approve",
            targetTable:   "member_registrations",
            targetId:      referenceId,
            ip:            clientIp(request),
          });
        }

        // Auto check-in: parent is physically here paying cash for today's session.
        // Bulk purchases are payment-only, sessions are used later via UseSessionButton.
        const isBulkPurchase = finalType.endsWith("_bulk");
        if (reg && !isBulkPurchase) {
          const kidsCount = reg.kids_count ?? 1;
          await admin.from("attendance_logs").insert({
            member_id:       referenceId,
            member_name:     reg.name,
            kids_count:      kidsCount,
            kids_names:      regKidsNames,
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

      const actor = posActor(staffType, staffId, staffName);
      if (actor) {
        await logStaffAction({
          actor,
          actionType:    "approve",
          targetTable:   "member_registrations",
          targetId:      referenceId,
          ip:            clientIp(request),
        });
      }

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

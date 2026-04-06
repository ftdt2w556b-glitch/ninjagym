import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

/** Points = floor(amount / 100), minimum 1. Bonus for events. */
function calcPoints(amount: number, sourceType: string): number {
  const base = Math.max(1, Math.floor(amount / 100));
  const bonus = sourceType === "birthday" ? 10 : sourceType === "daycamp" ? 5 : 0;
  return base + bonus;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const id = formData.get("id") as string;
  const action = formData.get("action") as string;
  const type = formData.get("type") as string; // 'member' | 'event' | 'shop'
  const notes = formData.get("notes") as string | null;

  if (!id || !action || !type) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // All staff may approve/reject. Only admin/manager may restore (undo) an approval.
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  const callerRole = callerProfile?.role ?? "";
  if (!["admin", "manager", "staff", "owner"].includes(callerRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (action === "restore" && !["admin", "manager"].includes(callerRole)) {
    return NextResponse.json({ error: "Forbidden — only admin or manager can undo an approval" }, { status: 403 });
  }
  const slip_status =
    action === "approve"  ? "approved"       :
    action === "restore"  ? "pending_review" :
    "rejected";

  const table =
    type === "member"
      ? "member_registrations"
      : type === "event"
      ? "event_bookings"
      : "shop_orders";

  const { error } = await admin
    .from(table)
    .update({
      slip_status,
      slip_reviewed_at: new Date().toISOString(),
      ...(notes ? { slip_notes: notes } : {}),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Sync linked member record when an event booking changes status ──
  if (type === "event") {
    await admin
      .from("member_registrations")
      .update({ slip_status, slip_reviewed_at: new Date().toISOString() })
      .eq("event_booking_id", id);
  }

  // ── Award loyalty points on approval ──────────────────────────
  if (action === "approve") {
    try {
      const sourceType =
        type === "member" ? "registration" :
        type === "event"  ? "birthday"     :
        "shop_order";

      // Fetch the record to get email, amount, membership type, and top-up link
      const { data: record } = await admin
        .from(table)
        .select("email, amount_paid, total_amount, membership_type, parent_member_id, sessions_remaining")
        .eq("id", id)
        .single();

      const email = record?.email as string | null;
      const amount = (record?.amount_paid ?? record?.total_amount ?? 0) as number;

      // ── Top-up: add sessions to parent card on approval ──────────
      if (type === "member" && record?.parent_member_id) {
        try {
          const parentId = record.parent_member_id as number;
          const addedSessions = (record.sessions_remaining as number | null) ?? 0;
          if (addedSessions > 0) {
            const { data: parent } = await admin
              .from("member_registrations")
              .select("sessions_remaining, sessions_purchased")
              .eq("id", parentId)
              .single();
            const current = (parent?.sessions_remaining as number | null) ?? 0;
            const currentPurchased = (parent?.sessions_purchased as number | null) ?? 0;
            await admin
              .from("member_registrations")
              .update({
                sessions_remaining: current + addedSessions,
                sessions_purchased: currentPurchased + addedSessions,
              })
              .eq("id", parentId);
          }
        } catch (topUpErr) {
          console.error("Top-up session merge failed:", topUpErr);
        }
      }

      // Set expiry for monthly_flex memberships (30 days from approval)
      if (type === "member" && record?.membership_type === "monthly_flex") {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await admin
          .from("member_registrations")
          .update({ expires_at: expiresAt.toISOString() })
          .eq("id", id);
      }

      // ── Decrement inventory for approved shop orders ──────────
      if (type === "shop") {
        try {
          const { data: order } = await admin
            .from("shop_orders")
            .select("items")
            .eq("id", id)
            .single();
          const items = (order?.items ?? []) as Array<{
            id: string; qty: number; size_or_flavor?: string | null;
          }>;
          for (const item of items) {
            if (item.id === "gift_card") continue; // no physical stock
            const variant = item.size_or_flavor ?? "";
            const { data: inv } = await admin
              .from("shop_inventory")
              .select("stock_qty")
              .eq("item_id", item.id)
              .eq("variant", variant)
              .maybeSingle();
            const newQty = Math.max(0, (inv?.stock_qty ?? 0) - item.qty);
            await admin
              .from("shop_inventory")
              .upsert(
                { item_id: item.id, variant, stock_qty: newQty, updated_at: new Date().toISOString() },
                { onConflict: "item_id,variant" }
              );
          }
        } catch (invErr) {
          console.error("Inventory decrement failed:", invErr);
        }
      }

      if (email && amount > 0) {
        const points = calcPoints(amount, sourceType);

        // Look up profile_id by email (optional match)
        const { data: profile } = await admin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        await admin.from("loyalty_transactions").insert({
          email,
          profile_id: profile?.id ?? null,
          source_type: sourceType,
          source_id: Number(id),
          points,
          description: `${points} point${points !== 1 ? "s" : ""} earned on ${sourceType.replace("_", " ")} #${id}`,
        });
      }
    } catch (loyaltyErr) {
      // Non-fatal — log but don't block the approval response
      console.error("Loyalty points award failed:", loyaltyErr);
    }
  }
  // ──────────────────────────────────────────────────────────────

  // Return JSON for fetch/XHR callers; redirect for plain form POSTs
  const acceptsJson = request.headers.get("accept")?.includes("application/json");
  if (acceptsJson) {
    return NextResponse.json({ success: true, slip_status });
  }

  const referer = request.headers.get("referer") ?? "/admin/payments";
  return NextResponse.redirect(new URL(referer, request.url));
}

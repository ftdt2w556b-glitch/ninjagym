import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

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

  const admin = createAdminClient();
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

  // ── Award loyalty points on approval ──────────────────────────
  if (action === "approve") {
    try {
      const sourceType =
        type === "member" ? "registration" :
        type === "event"  ? "birthday"     :
        "shop_order";

      // Fetch the record to get email + amount
      const { data: record } = await admin
        .from(table)
        .select("email, amount_paid, total_amount")
        .eq("id", id)
        .single();

      const email = record?.email as string | null;
      const amount = (record?.amount_paid ?? record?.total_amount ?? 0) as number;

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

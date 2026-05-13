import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { resolveMembershipType } from "@/lib/pricing";

export async function POST(req: NextRequest) {
  // Verify POS auth cookie
  const cookieStore = await cookies();
  const posAuth = cookieStore.get("pos_auth")?.value;
  const admin = createAdminClient();
  const { data: pwSetting } = await admin.from("settings").select("value").eq("key", "pos_password").maybeSingle();
  const expected = pwSetting?.value ?? process.env.POS_PASSWORD ?? null;
  const isUnlocked = expected ? posAuth === expected : posAuth === "unlocked";
  if (!isUnlocked) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action, staff_name, reason } = await req.json();

  const { data: pending } = await admin
    .from("pending_checkins")
    .select("*")
    .eq("id", id)
    .single();

  if (!pending) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pending.status !== "pending") return NextResponse.json({ error: "Already handled" }, { status: 400 });

  const now = new Date().toISOString();

  // Bulk session purchases (e.g. 10_bulk, 20_bulk) are payment-only approvals:
  // staff approves the slip and the package becomes usable; no check-in occurs.
  // A "use a session" tap from the parent's card ALSO creates a pending row whose
  // membership_type ends in _bulk (since they're using sessions from a bulk pack),
  // but it carries NO payment_method. The payment_method field is the reliable
  // discriminator, purchase rows always have it, session-use rows never do.
  const isBulkPurchase =
    (pending.membership_type?.endsWith("_bulk") ?? false) && !!pending.payment_method;

  // Free loyalty session redemption, log attendance + increment free_sessions_redeemed.
  // Must NOT deduct sessions_remaining or touch slip_status/slip_reviewed_at.
  const isFreeSessionLoyalty = pending.membership_type === "free_session_loyalty";

  // Belt perk redemption, no attendance log, no session deduction, no slip_status change.
  // Staff just confirms the perk at the centre; the pending_checkin is the only record.
  const isPerkRedemption = pending.membership_type?.startsWith("belt_perk_") ?? false;

  if (action === "approve") {
    if (isFreeSessionLoyalty) {
      // Log the check-in
      await admin.from("attendance_logs").insert({
        member_id:       pending.member_id,
        member_name:     pending.member_name,
        kids_count:      pending.kids_count,
        kids_names:      pending.kids_names ?? null,
        membership_type: "free_session_loyalty",
        notes:           `Free loyalty session approved by ${staff_name ?? "staff"}`,
        check_in_at:     now,
      });

      // Increment the redemption counter on the member
      const { data: reg } = await admin
        .from("member_registrations")
        .select("free_sessions_redeemed")
        .eq("id", pending.member_id)
        .single();

      const currentRedeemed = (reg?.free_sessions_redeemed as number) ?? 0;
      await admin
        .from("member_registrations")
        .update({ free_sessions_redeemed: currentRedeemed + 1 })
        .eq("id", pending.member_id);

    } else if (isPerkRedemption) {
      // Log the perk redemption as a check-in so it appears in the Check-ins tab
      // and counts toward the day's record. We deliberately leave membership_type
      // NULL so (a) no auto-timer is generated and (b) the Check-ins UI doesn't
      // try to render the raw "belt_perk_*" id. The perk label lives in `notes`.
      const perkLabel = pending.membership_label ?? pending.membership_type ?? "Belt perk";
      await admin.from("attendance_logs").insert({
        member_id:       pending.member_id,
        member_name:     pending.member_name,
        kids_count:      pending.kids_count,
        kids_names:      pending.kids_names ?? null,
        membership_type: null,
        notes:           `🥋 PERK: ${perkLabel}, approved by ${staff_name ?? "staff"}`,
        check_in_at:     now,
      });

      // Record this redemption. Perks are re-earnable, each approval is its own
      // row. The /api/members/[id]/redeem-perk POST is the gate that prevents a
      // family from queueing too many at once; once a redemption is recorded here,
      // the threshold for the next one doubles (3rd triples, etc).
      // Top-up rows resolve to the parent family so a member can't redeem the
      // same perk from each of their top-up registrations.
      const { data: memberRow } = await admin
        .from("member_registrations")
        .select("parent_member_id")
        .eq("id", pending.member_id)
        .maybeSingle();
      const familyId = (memberRow?.parent_member_id as number | null) ?? pending.member_id;
      await admin
        .from("member_perks_redeemed")
        .insert({
          family_id:   familyId,
          perk_type:   pending.membership_type,
          pending_id:  pending.id,
          redeemed_at: now,
        });

    } else if (!isBulkPurchase) {
      // Create the attendance log
      await admin.from("attendance_logs").insert({
        member_id: pending.member_id,
        member_name: pending.member_name,
        kids_count: pending.kids_count,
        kids_names: pending.kids_names ?? null,
        membership_type: resolveMembershipType(pending.membership_type),
        notes: `Check-in approved by ${staff_name ?? "staff"}`,
        check_in_at: now,
      });

      // Deduct sessions from the package
      const { data: reg } = await admin
        .from("member_registrations")
        .select("sessions_remaining")
        .eq("id", pending.member_id)
        .single();

      if (reg && reg.sessions_remaining !== null) {
        await admin
          .from("member_registrations")
          .update({ sessions_remaining: Math.max(0, reg.sessions_remaining - pending.kids_count) })
          .eq("id", pending.member_id);
      }
    }

    if (!isFreeSessionLoyalty && !isPerkRedemption) {
      // Only stamp slip_reviewed_at + flip to approved for real payment approvals.
      // Session USE approvals (already-approved packages) must NOT update slip_reviewed_at -
      // doing so re-surfaces the original purchase amount in today's sales totals.
      await admin
        .from("member_registrations")
        .update({ slip_status: "approved", slip_reviewed_at: now })
        .eq("id", pending.member_id)
        .eq("slip_status", "pending_review");
    }

    await admin
      .from("pending_checkins")
      .update({ status: "approved", handled_by: staff_name ?? "staff", handled_at: now })
      .eq("id", id);

  } else if (action === "reject") {
    if (!isFreeSessionLoyalty && !isPerkRedemption) {
      // Only mark the registration rejected if it is still pending_review
      // (i.e. this is a payment rejection, not a rejection of a session USE request
      // on an already-approved package, we must never flip approved → rejected here)
      const rejectUpdate: Record<string, string> = { slip_status: "rejected" };
      if (reason?.trim()) {
        rejectUpdate.slip_notes = `Rejected by ${staff_name ?? "staff"}: ${reason.trim()}`;
      }
      await admin
        .from("member_registrations")
        .update(rejectUpdate)
        .eq("id", pending.member_id)
        .eq("slip_status", "pending_review");
    }

    await admin
      .from("pending_checkins")
      .update({ status: "rejected", handled_by: staff_name ?? "staff", handled_at: now })
      .eq("id", id);
  }

  return NextResponse.json({ success: true });
}

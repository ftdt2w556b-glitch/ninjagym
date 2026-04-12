import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyMemberToken } from "@/lib/member-token";

/**
 * POST /api/checkin/cancel-topup
 * Parent-initiated cancel of a pending PromptPay top-up registration.
 * Verifies the token, confirms ownership, then rejects the pending_checkin
 * and the member_registration so staff queue is cleared.
 */
export async function POST(req: NextRequest) {
  const { reg_id, parent_member_id, token } = await req.json();

  if (!reg_id || !parent_member_id || !token) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify the card token belongs to the parent
  if (!verifyMemberToken(Number(parent_member_id), token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Confirm the registration actually belongs to this parent (security check)
  const { data: reg } = await admin
    .from("member_registrations")
    .select("id, parent_member_id, slip_status")
    .eq("id", reg_id)
    .eq("parent_member_id", parent_member_id)
    .maybeSingle();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found or not yours" }, { status: 404 });
  }

  if (reg.slip_status === "approved") {
    return NextResponse.json({ error: "Already approved — speak to staff to cancel" }, { status: 409 });
  }

  // Reject the pending_checkin so it disappears from staff queue
  await admin
    .from("pending_checkins")
    .update({ status: "rejected" })
    .eq("member_id", reg_id)
    .eq("status", "pending");

  // Mark the registration as rejected (keeps it as a history record)
  await admin
    .from("member_registrations")
    .update({ slip_status: "rejected" })
    .eq("id", reg_id);

  return NextResponse.json({ success: true });
}

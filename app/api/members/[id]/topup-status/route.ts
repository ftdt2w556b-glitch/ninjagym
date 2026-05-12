import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyMemberToken } from "@/lib/member-token";

/**
 * GET /api/members/[id]/topup-status?token=<cardToken>
 *
 * Token-gated polling endpoint for the parent's top-up flow.
 *
 * Returns just enough state to drive the "waiting for staff" UI on
 * TopUpSection without exposing PII:
 *  - `slip_status` from this registration row (cash flow watches this flip
 *    from `cash_pending` → `approved`)
 *  - `pending_status` from the most recent pending_checkins row for this
 *    member (PromptPay flow watches this for `pending` → `approved/rejected`)
 *
 * Token must verify against either the registration's id or its parent_member_id
 * (top-up rows share the same family card token).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const memberId = Number(id);
  const token    = request.nextUrl.searchParams.get("token");
  if (!memberId || isNaN(memberId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("member_registrations")
    .select("id, parent_member_id, slip_status")
    .eq("id", memberId)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const familyId = (member.parent_member_id as number | null) ?? memberId;
  const tokenOk  =
    verifyMemberToken(memberId, token) ||
    verifyMemberToken(familyId, token);

  if (!tokenOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Most recent pending_checkins row for this member, regardless of status, so
  // the client can react to approve/reject transitions.
  const { data: pending } = await admin
    .from("pending_checkins")
    .select("id, status")
    .eq("member_id", memberId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    slip_status:    member.slip_status as string | null,
    pending_id:     pending?.id ?? null,
    pending_status: pending?.status ?? null,
  });
}

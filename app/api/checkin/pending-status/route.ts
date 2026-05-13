import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyMemberToken } from "@/lib/member-token";

/**
 * GET /api/checkin/pending-status?id=<pendingId>&token=<cardToken>
 *
 * Token-gated polling endpoint. Replaces the public realtime subscription
 * parents used to use on pending_checkins (which leaked every parent's name,
 * kids' names, and amount to any anon subscriber).
 *
 * Returns only the minimal fields the parent's card UI needs to react to the
 * status change. The token must be signed for the pending row's member_id
 * (resolved through parent_member_id for top-up rows).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const id    = Number(url.searchParams.get("id"));
  const token = url.searchParams.get("token");

  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Find the pending row's member and the parent family it belongs to.
  const { data: pending } = await admin
    .from("pending_checkins")
    .select("id, status, member_id")
    .eq("id", id)
    .maybeSingle();

  if (!pending) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: member } = await admin
    .from("member_registrations")
    .select("id, parent_member_id")
    .eq("id", pending.member_id)
    .maybeSingle();

  const familyId = (member?.parent_member_id as number | null) ?? pending.member_id;

  // Token may be signed for the pending row's member_id (e.g. perk redemption
  // on the parent card), the parent family id, or the original top-up row.
  // Accept any of them, they all prove possession of the same card.
  const tokenOk =
    verifyMemberToken(pending.member_id, token) ||
    verifyMemberToken(familyId,           token);

  if (!tokenOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ id: pending.id, status: pending.status });
}

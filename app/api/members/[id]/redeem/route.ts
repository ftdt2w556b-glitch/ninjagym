import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyMemberToken } from "@/lib/member-token";

/**
 * POST /api/members/[id]/redeem
 * Increments free_sessions_redeemed by 1.
 * Auth: member card token (no admin login required — member self-serves from card page).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const memberId = Number(id);

  if (isNaN(memberId)) {
    return NextResponse.json({ error: "Invalid member ID" }, { status: 400 });
  }

  const body = await request.json();
  const { token } = body as { token?: string };

  // Verify the member card token — same check the card page does
  if (!verifyMemberToken(memberId, token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch current value and confirm member exists
  const { data: member, error: fetchErr } = await admin
    .from("member_registrations")
    .select("id, free_sessions_redeemed, name")
    .eq("id", memberId)
    .maybeSingle();

  if (fetchErr || !member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const current = (member.free_sessions_redeemed as number) ?? 0;

  const { error: updateErr } = await admin
    .from("member_registrations")
    .update({ free_sessions_redeemed: current + 1 })
    .eq("id", memberId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, free_sessions_redeemed: current + 1 });
}

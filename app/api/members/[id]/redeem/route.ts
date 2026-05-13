import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyMemberToken } from "@/lib/member-token";

/**
 * POST /api/members/[id]/redeem
 * Creates a pending_checkin for a free loyalty session.
 * Auth: member card token, no admin login required.
 *
 * On staff approval (/api/checkin/handle), the handle route detects
 * membership_type === "free_session_loyalty" and increments
 * free_sessions_redeemed instead of deducting sessions_remaining.
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
  const { token, kids_names } = body as { token?: string; kids_names?: string };

  if (!verifyMemberToken(memberId, token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch member, need name, kids_names, and current redemption count
  const { data: member } = await admin
    .from("member_registrations")
    .select("id, name, kids_names, free_sessions_redeemed")
    .eq("id", memberId)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Server-side eligibility check, count attendance_logs ourselves so the
  // client can't claim more sessions than they've earned. Mirrors the rule in
  // app/(public)/qr/card/[id]/page.tsx and components/public/QrCardClient.tsx:
  // 1 pip per unique Bangkok day, excluding climb_unguided and free_session_loyalty.
  const { data: topUps } = await admin
    .from("member_registrations")
    .select("id")
    .eq("parent_member_id", memberId)
    .eq("slip_status", "approved");

  const allIds = [memberId, ...((topUps ?? []).map((r) => r.id as number))];

  const { data: logs } = await admin
    .from("attendance_logs")
    .select("membership_type, check_in_at")
    .in("member_id", allIds);

  const uniqueDays = new Set(
    (logs ?? [])
      .filter((r) => r.membership_type !== "climb_unguided" && r.membership_type !== "free_session_loyalty")
      .map((r) => {
        if (!r.check_in_at) return null;
        const d = new Date(new Date(r.check_in_at as string).getTime() + 7 * 3600 * 1000);
        return d.toISOString().slice(0, 10);
      })
      .filter((d): d is string => d !== null)
  );

  const FREE_SESSION_CHECKINS = 10;
  const freeSessionsEarned = Math.floor(uniqueDays.size / FREE_SESSION_CHECKINS);
  const redeemed = (member.free_sessions_redeemed as number) ?? 0;

  if (freeSessionsEarned <= redeemed) {
    return NextResponse.json({ error: "No free sessions available" }, { status: 400 });
  }

  // Prevent duplicate pending requests
  const { data: existing } = await admin
    .from("pending_checkins")
    .select("id")
    .eq("member_id", memberId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ id: existing.id });
  }

  // Create the pending_checkin, staff see it in the approval queue
  const { data, error } = await admin
    .from("pending_checkins")
    .insert({
      member_id:        memberId,
      member_name:      member.name as string,
      kids_count:       1,
      kids_names:       (kids_names ?? member.kids_names ?? null) as string | null,
      membership_type:  "free_session_loyalty",
      membership_label: "🎁 Free Loyalty Session",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyMemberToken } from "@/lib/member-token";

// Base unique-check-in-day thresholds per perk. Must mirror BELTS in
// components/public/QrCardClient.tsx. The Nth redemption of a perk requires
// uniqueCheckInDays >= threshold × N.
const PERK_BASE_THRESHOLD: Record<string, number> = {
  belt_perk_friend:   10,
  belt_perk_game:     15,
  belt_perk_1on1:     20,
  belt_perk_combo:    40,
  belt_perk_party:    50,
  belt_perk_birthday: 60,
};
const VALID_PERK_TYPES = new Set(Object.keys(PERK_BASE_THRESHOLD));

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const memberId = Number(id);
  if (isNaN(memberId)) return NextResponse.json({ error: "Invalid member ID" }, { status: 400 });

  const body = await request.json();
  const { token, perkType, perkLabel, memberName, kidsNames } = body as {
    token?: string;
    perkType?: string;
    perkLabel?: string;
    memberName?: string;
    kidsNames?: string | null;
  };

  if (!verifyMemberToken(memberId, token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (!perkType || !VALID_PERK_TYPES.has(perkType)) {
    return NextResponse.json({ error: "Invalid perk type" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: member } = await admin
    .from("member_registrations")
    .select("id, name, parent_member_id")
    .eq("id", memberId)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Perks are re-earnable. The Nth redemption requires uniqueCheckInDays >=
  // baseThreshold × N. Family is the parent registration (top-up rows resolved up).
  const familyId = (member.parent_member_id as number | null) ?? memberId;

  const { count: redeemedCount } = await admin
    .from("member_perks_redeemed")
    .select("*", { count: "exact", head: true })
    .eq("family_id", familyId)
    .eq("perk_type", perkType);

  // Recompute uniqueCheckInDays the same way QrCardClient does: gather every
  // attendance_logs row for this family (parent + top-ups), dedupe on Bangkok date,
  // excluding climb_unguided + free_session_loyalty.
  const { data: familyIds } = await admin
    .from("member_registrations")
    .select("id")
    .or(`id.eq.${familyId},parent_member_id.eq.${familyId}`);
  const allMemberIds = (familyIds ?? []).map((r) => r.id as number);
  const { data: checkInRows } = await admin
    .from("attendance_logs")
    .select("check_in_at, membership_type")
    .in("member_id", allMemberIds.length > 0 ? allMemberIds : [familyId]);
  const uniqueDays = new Set(
    (checkInRows ?? [])
      .filter((r) => r.membership_type !== "climb_unguided" && r.membership_type !== "free_session_loyalty")
      .map((r) => {
        const t = r.check_in_at as string | null;
        if (!t) return null;
        // Shift to Bangkok (UTC+7) then slice YYYY-MM-DD
        return new Date(new Date(t).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
      })
      .filter((d): d is string => d !== null),
  ).size;

  const baseThreshold = PERK_BASE_THRESHOLD[perkType];
  const requiredDays  = baseThreshold * ((redeemedCount ?? 0) + 1);
  if (uniqueDays < requiredDays) {
    return NextResponse.json(
      {
        error: `This perk re-unlocks at ${requiredDays} unique check-in days. You're at ${uniqueDays}.`,
        unique_days: uniqueDays,
        required_days: requiredDays,
      },
      { status: 409 },
    );
  }

  // One pending request per perk type — prevent duplicate requests for the same perk
  const { data: existing } = await admin
    .from("pending_checkins")
    .select("id")
    .eq("member_id", memberId)
    .eq("membership_type", perkType)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) return NextResponse.json({ ok: true, id: existing.id });

  const { data, error } = await admin
    .from("pending_checkins")
    .insert({
      member_id:        memberId,
      member_name:      (memberName ?? member.name) as string,
      kids_count:       1,
      kids_names:       kidsNames ?? null,
      membership_type:  perkType,
      membership_label: `🥋 ${perkLabel ?? perkType}`,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data.id });
}

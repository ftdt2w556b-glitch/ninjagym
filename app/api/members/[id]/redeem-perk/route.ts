import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyMemberToken } from "@/lib/member-token";

const VALID_PERK_TYPES = new Set([
  "belt_perk_friend",
  "belt_perk_game",
  "belt_perk_1on1",
  "belt_perk_combo",
  "belt_perk_party",
  "belt_perk_birthday",
]);

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
    .select("id, name")
    .eq("id", memberId)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

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

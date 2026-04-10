import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyMemberToken } from "@/lib/member-token";

export async function POST(req: NextRequest) {
  const { member_id, auth_id, kids_count, membership_type, membership_label, token } = await req.json();

  // auth_id is the parent/main registration ID that the cardToken is signed for.
  // member_id may be a top-up package with a different ID.
  if (!verifyMemberToken(Number(auth_id ?? member_id), token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch member to confirm sessions available
  const { data: reg } = await admin
    .from("member_registrations")
    .select("sessions_remaining, name")
    .eq("id", member_id)
    .single();

  if (!reg) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (reg.sessions_remaining !== null && reg.sessions_remaining < 1) {
    return NextResponse.json({ error: "Not enough sessions remaining" }, { status: 400 });
  }

  // Return existing pending request if there is one (prevent double-submit)
  const { data: existing } = await admin
    .from("pending_checkins")
    .select("id")
    .eq("member_id", member_id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    // Parent may have gone back and changed their kids count — always update to latest selection
    await admin
      .from("pending_checkins")
      .update({ kids_count, membership_type, membership_label })
      .eq("id", existing.id);
    return NextResponse.json({ id: existing.id });
  }

  const { data, error } = await admin
    .from("pending_checkins")
    .insert({
      member_id,
      member_name: reg.name,
      kids_count,
      membership_type,
      membership_label,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id });
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  // Verify POS auth cookie
  const cookieStore = await cookies();
  const posAuth = cookieStore.get("pos_auth")?.value;
  const admin = createAdminClient();
  const { data: pwSetting } = await admin.from("settings").select("value").eq("key", "pos_password").maybeSingle();
  const expected = pwSetting?.value ?? process.env.POS_PASSWORD ?? null;
  const isUnlocked = expected ? posAuth === expected : posAuth === "unlocked";
  if (!isUnlocked) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action, staff_name } = await req.json();

  const { data: pending } = await admin
    .from("pending_checkins")
    .select("*")
    .eq("id", id)
    .single();

  if (!pending) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pending.status !== "pending") return NextResponse.json({ error: "Already handled" }, { status: 400 });

  const now = new Date().toISOString();

  if (action === "approve") {
    // Create the attendance log
    await admin.from("attendance_logs").insert({
      member_id: pending.member_id,
      member_name: pending.member_name,
      kids_count: pending.kids_count,
      membership_type: pending.membership_type,
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

    await admin
      .from("pending_checkins")
      .update({ status: "approved", handled_by: staff_name ?? "staff", handled_at: now })
      .eq("id", id);

  } else if (action === "reject") {
    await admin
      .from("pending_checkins")
      .update({ status: "rejected", handled_by: staff_name ?? "staff", handled_at: now })
      .eq("id", id);
  }

  return NextResponse.json({ success: true });
}

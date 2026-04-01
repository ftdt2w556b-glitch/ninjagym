import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/checkin
 * Body: { member_id, note? }
 *
 * 1. Validates member exists and is approved
 * 2. Creates attendance_log entry
 * 3. Decrements sessions_remaining (if session-based membership)
 * 4. Awards 1 loyalty point per check-in (if email on file)
 * Returns: { success, attendance_id, sessions_remaining, warned }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const member_id = Number(body.member_id);
    const note = (body.note as string | undefined) ?? null;

    if (!member_id) {
      return NextResponse.json({ error: "member_id required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch member
    const { data: member, error: fetchErr } = await admin
      .from("member_registrations")
      .select("id, name, email, membership_type, slip_status, sessions_remaining")
      .eq("id", member_id)
      .single();

    if (fetchErr || !member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const warned = member.slip_status !== "approved";

    // Log attendance
    const { data: log, error: logErr } = await admin
      .from("attendance_logs")
      .insert({
        member_id: member.id,
        member_name: member.name,
        member_email: member.email ?? null,
        check_in_at: new Date().toISOString(),
        notes: note,
      })
      .select("id")
      .single();

    if (logErr) throw logErr;

    // Decrement sessions_remaining if session-based
    let newSessions: number | null = member.sessions_remaining;
    if (member.sessions_remaining !== null && member.sessions_remaining > 0) {
      newSessions = member.sessions_remaining - 1;
      await admin
        .from("member_registrations")
        .update({ sessions_remaining: newSessions })
        .eq("id", member.id);
    }

    // Award 1 loyalty point per check-in (non-fatal)
    if (member.email) {
      try {
        const { data: profile } = await admin
          .from("profiles")
          .select("id")
          .eq("email", member.email)
          .maybeSingle();

        await admin.from("loyalty_transactions").insert({
          email: member.email,
          profile_id: profile?.id ?? null,
          source_type: "registration",
          source_id: member.id,
          points: 1,
          description: `Check-in point: attendance #${log.id}`,
        });
      } catch (e) {
        console.error("Loyalty check-in point failed:", e);
      }
    }

    return NextResponse.json({
      success: true,
      attendance_id: log.id,
      sessions_remaining: newSessions,
      warned,
    });
  } catch (err: unknown) {
    console.error("POST /api/checkin error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

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
    const kids_count_override = body.kids_count_override != null ? Math.max(1, Number(body.kids_count_override)) : null;

    if (!member_id) {
      return NextResponse.json({ error: "member_id required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch member
    const { data: member, error: fetchErr } = await admin
      .from("member_registrations")
      .select("id, name, email, membership_type, slip_status, sessions_remaining, kids_count, kids_names, parent_member_id")
      .eq("id", member_id)
      .single();

    if (fetchErr || !member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Block unapproved members
    if (member.slip_status !== "approved") {
      return NextResponse.json(
        { error: "Payment not approved yet — approve the member first before checking in." },
        { status: 403 }
      );
    }

    const outOfSessions = member.sessions_remaining !== null && member.sessions_remaining === 0;
    const warned = outOfSessions;

    // Kids count — use override from staff (e.g. mom has 2 kids but only brought 1 today)
    const kidsCount = kids_count_override !== null ? kids_count_override : Math.max(1, member.kids_count ?? 1);
    const kidsSuffix = kidsCount > 1 ? ` | ${kidsCount} kids` : "";
    const fullNote = note ? `${note}${kidsSuffix}` : kidsSuffix || null;

    // Kids names — for top-ups, look up from parent registration
    let kidsNames: string | null = member.kids_names ?? null;
    if (!kidsNames && member.parent_member_id) {
      const { data: parent } = await admin
        .from("member_registrations")
        .select("kids_names")
        .eq("id", member.parent_member_id)
        .maybeSingle();
      kidsNames = parent?.kids_names ?? null;
    }

    // Log attendance
    const { data: log, error: logErr } = await admin
      .from("attendance_logs")
      .insert({
        member_id: member.id,
        member_name: member.name,
        member_email: member.email ?? null,
        check_in_at: new Date().toISOString(),
        notes: fullNote,
        kids_count: kidsCount,
        kids_names: kidsNames,
        membership_type: member.membership_type ?? null,
      })
      .select("id")
      .single();

    if (logErr) throw logErr;

    // Decrement sessions_remaining if session-based (deduct by kids count)
    let newSessions: number | null = member.sessions_remaining;
    if (member.sessions_remaining !== null && member.sessions_remaining > 0) {
      newSessions = Math.max(0, member.sessions_remaining - kidsCount);
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
      outOfSessions,
    });
  } catch (err: unknown) {
    console.error("POST /api/checkin error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

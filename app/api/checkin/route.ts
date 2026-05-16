import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireWritePin } from "@/lib/staff-pin-server";
import { logStaffAction } from "@/lib/staff-actions";

/**
 * POST /api/checkin
 * Body: { member_id, note? }
 *
 * 1. Validates member exists and is approved
 * 2. Creates attendance_log entry
 * 3. Decrements sessions_remaining (if session-based membership)
 * 4. Awards 1 loyalty point per check-in (if email on file)
 * Returns: { success, attendance_id, sessions_remaining, warned }
 *
 * Auth: requires a logged-in staff/admin user (called from admin CheckInButton).
 * Parent-driven check-in goes through /api/checkin/request → /api/checkin/handle instead.
 */
export async function POST(request: NextRequest) {
  // PIN-gated: requireWritePin resolves the actor from the ng_pin_write
  // cookie (or admin/owner session bypass) and returns 401 + pin_required
  // for staff who haven't typed their PIN yet so the client modal opens.
  const auth = await requireWritePin(request);
  if ("response" in auth) return auth.response;
  const { actor, sessionUserId, ip } = auth;

  try {
    const body = await request.json();
    const member_id = Number(body.member_id);
    // Ignore body.note's staff portion — we rebuild it from the resolved
    // actor so "Check-in by NinjaGym" becomes "Check-in by Naing".
    const _ignoredClientNote = (body.note as string | undefined) ?? null;
    void _ignoredClientNote;
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
        { error: "Payment not approved yet, approve the member first before checking in." },
        { status: 403 }
      );
    }

    const outOfSessions = member.sessions_remaining !== null && member.sessions_remaining === 0;
    const warned = outOfSessions;

    // Kids count, use override from staff (e.g. mom has 2 kids but only brought 1 today)
    const kidsCount = kids_count_override !== null ? kids_count_override : Math.max(1, member.kids_count ?? 1);
    const kidsSuffix = kidsCount > 1 ? ` | ${kidsCount} kids` : "";
    // Rebuild the note from the resolved actor name so attendance logs read
    // "Check-in by Naing" / "Win" instead of "Check-in by NinjaGym".
    const staffNote = `Check-in by ${actor.name}`;
    const fullNote  = `${staffNote}${kidsSuffix}`;

    // Kids names, for top-ups, look up from parent registration
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

    // Audit log: who checked this member in.
    await logStaffAction({
      actor,
      actionType:    "other",
      targetTable:   "attendance_logs",
      targetId:      log.id,
      ip,
      sessionUserId,
    });

    return NextResponse.json({
      success: true,
      attendance_id: log.id,
      sessions_remaining: newSessions,
      warned,
      outOfSessions,
      actor_name: actor.name,
    });
  } catch (err: unknown) {
    console.error("POST /api/checkin error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

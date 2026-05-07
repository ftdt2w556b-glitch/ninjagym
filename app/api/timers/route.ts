import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { bangkokStartOfDay, bangkokEndOfDay } from "@/lib/timezone";

const STAFF_ROLES = ["admin", "manager", "staff", "owner"];

async function requireStaff() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !STAFF_ROLES.includes(profile.role)) return null;
  return user;
}

// Membership types that don't get an auto-timer (no point fetching them).
const NO_TIMER_TYPES = ["all_day", "allday_bulk", "birthday_event"];

/**
 * GET /api/timers
 * Returns today's auto-timers (from attendance_logs) + all active custom timers
 * + the day-camp end time + server clock.
 *
 * The client computes remaining time from (startedAt + duration) using its own
 * local clock, but it also rebases on serverNow so a wrong device clock won't
 * make timers off.
 */
export async function GET() {
  if (!(await requireStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const [logsRes, customRes, settingRes] = await Promise.all([
    admin
      .from("attendance_logs")
      .select("id, member_id, member_name, kids_count, kids_names, membership_type, check_in_at")
      .gte("check_in_at", bangkokStartOfDay())
      .lte("check_in_at", bangkokEndOfDay())
      .order("check_in_at", { ascending: true }),
    admin
      .from("custom_timers")
      .select("id, name, minutes, started_at")
      .eq("dismissed", false)
      .order("started_at", { ascending: true }),
    admin
      .from("settings")
      .select("value")
      .eq("key", "daycamp_end_time")
      .maybeSingle(),
  ]);

  const autoTimers = (logsRes.data ?? [])
    .filter((r) => r.membership_type && !NO_TIMER_TYPES.includes(r.membership_type))
    .map((r) => ({
      id: r.id as number,
      memberId: r.member_id as number | null,
      memberName: (r.member_name as string | null) ?? "Unknown",
      kidsCount: (r.kids_count as number | null) ?? 1,
      kidsNames: (r.kids_names as string | null) ?? null,
      membershipType: r.membership_type as string,
      startedAt: r.check_in_at as string,
    }));

  const customTimers = (customRes.data ?? []).map((r) => ({
    id: r.id as number,
    name: r.name as string,
    minutes: r.minutes as number,
    startedAt: r.started_at as string,
  }));

  return NextResponse.json({
    serverNow: new Date().toISOString(),
    daycampEndTime: (settingRes.data?.value as string | undefined) ?? "14:00",
    autoTimers,
    customTimers,
  });
}

/**
 * POST /api/timers — create a custom timer (label + minutes).
 * Body: { name: string, minutes: number }
 */
export async function POST(request: NextRequest) {
  const user = await requireStaff();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const minutes = Number(body.minutes);

  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Name is required (max 60 chars)" }, { status: 400 });
  }
  if (!minutes || minutes < 1 || minutes > 1440) {
    return NextResponse.json({ error: "Minutes must be between 1 and 1440" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("custom_timers")
    .insert({ name, minutes, created_by: user.id })
    .select("id, name, minutes, started_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    name: data.name,
    minutes: data.minutes,
    startedAt: data.started_at,
  });
}

/**
 * PATCH /api/timers — dismiss a custom timer.
 * Body: { id: number }
 *
 * Auto-timers (attendance_logs) aren't dismissed here — staff dismiss them
 * client-side and the row falls off naturally at end of day.
 */
export async function PATCH(request: NextRequest) {
  if (!(await requireStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("custom_timers")
    .update({ dismissed: true })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

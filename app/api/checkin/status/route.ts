import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get("member_id");
  if (!memberId) return NextResponse.json({ error: "Missing member_id" }, { status: 400 });

  const admin = createAdminClient();

  // Bangkok "today" window
  const now = new Date();
  const bkk = new Date(now.getTime() + 7 * 3600 * 1000);
  const todayStr = bkk.toISOString().slice(0, 10);
  const from = `${todayStr}T00:00:00+07:00`;
  const to   = `${todayStr}T23:59:59+07:00`;

  const [{ data: pendingRow }, { data: todayLogs }] = await Promise.all([
    admin
      .from("pending_checkins")
      .select("id, kids_count, membership_label")
      .eq("member_id", memberId)
      .eq("status", "pending")
      .maybeSingle(),
    admin
      .from("attendance_logs")
      .select("check_in_at, kids_count")
      .eq("member_id", memberId)
      .gte("check_in_at", from)
      .lte("check_in_at", to)
      .order("check_in_at", { ascending: false })
      .limit(1),
  ]);

  const today = todayLogs?.[0] ?? null;

  return NextResponse.json({
    pending: pendingRow ?? null,
    today: today
      ? {
          time: new Date(today.check_in_at).toLocaleTimeString("en-US", {
            timeZone: "Asia/Bangkok", hour: "numeric", minute: "2-digit", hour12: true,
          }),
          kids_count: today.kids_count,
        }
      : null,
  });
}

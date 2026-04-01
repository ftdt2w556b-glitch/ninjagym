import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  bangkokToday,
  bangkokStartOfDay,
  bangkokEndOfDay,
  formatBangkokDate,
  formatBangkokTime,
} from "@/lib/timezone";

type Period = "today" | "week" | "month";

function getRange(period: Period): { from: string; to: string; label: string } {
  const today = bangkokToday();

  if (period === "today") {
    return {
      from: bangkokStartOfDay(today),
      to: bangkokEndOfDay(today),
      label: "Today",
    };
  }

  if (period === "week") {
    // Mon–Sun week in Bangkok time
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const day = d.getDay(); // 0=Sun
    const diffToMon = (day === 0 ? -6 : 1 - day);
    const mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
    const monStr = mon.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
    return {
      from: bangkokStartOfDay(monStr),
      to: bangkokEndOfDay(today),
      label: "This Week",
    };
  }

  // month
  const [y, m] = today.split("-");
  const monthStart = `${y}-${m}-01`;
  return {
    from: bangkokStartOfDay(monthStart),
    to: bangkokEndOfDay(today),
    label: "This Month",
  };
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; member?: string }>;
}) {
  const params = await searchParams;
  const period = (["today", "week", "month"].includes(params.period ?? "") ? params.period : "today") as Period;
  const memberFilter = params.member?.trim() ?? "";

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "manager", "staff", "owner"].includes(profile.role)) redirect("/admin/dashboard");

  const { from, to, label } = getRange(period);

  let query = admin
    .from("attendance_logs")
    .select("id, member_id, member_name, member_email, check_in_at, notes", { count: "exact" })
    .gte("check_in_at", from)
    .lte("check_in_at", to)
    .order("check_in_at", { ascending: false })
    .limit(200);

  if (memberFilter) {
    query = query.ilike("member_name", `%${memberFilter}%`);
  }

  const { data: logs, count } = await query;

  // Group by date for display
  const grouped = new Map<string, typeof logs>();
  for (const log of logs ?? []) {
    const dateKey = formatBangkokDate(log.check_in_at, { weekday: "short", month: "short", day: "numeric" });
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey)!.push(log);
  }

  const periods: { id: Period; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Check-in Records</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {count ?? 0} check-in{count !== 1 ? "s" : ""} — {label}
          </p>
        </div>

        {/* Period tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {periods.map((p) => (
            <Link
              key={p.id}
              href={`/admin/attendance?period=${p.id}${memberFilter ? `&member=${encodeURIComponent(memberFilter)}` : ""}`}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                period === p.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Search by name */}
      <form method="GET" action="/admin/attendance" className="flex gap-2">
        <input type="hidden" name="period" value={period} />
        <input
          type="text"
          name="member"
          defaultValue={memberFilter}
          placeholder="Filter by member name..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
        />
        <button
          type="submit"
          className="bg-[#1a56db] text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
        >
          Search
        </button>
        {memberFilter && (
          <Link
            href={`/admin/attendance?period=${period}`}
            className="text-sm text-gray-400 hover:text-gray-600 px-3 py-2.5"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Records */}
      {grouped.size === 0 ? (
        <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-400">
          No check-ins found for this period.
        </div>
      ) : (
        [...grouped.entries()].map(([dateLabel, dayLogs]) => (
          <div key={dateLabel} className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="font-bold text-gray-700 text-sm">{dateLabel}</span>
              <span className="text-xs text-gray-400 font-semibold">{dayLogs!.length} check-in{dayLogs!.length !== 1 ? "s" : ""}</span>
            </div>
            <ul className="divide-y divide-gray-50">
              {dayLogs!.map((log) => (
                <li key={log.id} className="px-5 py-3 flex items-center gap-4">
                  {/* Time */}
                  <span className="text-sm font-mono text-gray-400 w-12 shrink-0">
                    {formatBangkokTime(log.check_in_at)}
                  </span>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/admin/members?q=${encodeURIComponent(log.member_name ?? "")}`}
                      className="font-semibold text-gray-800 hover:text-[#1a56db] transition-colors text-sm"
                    >
                      {log.member_name ?? "Unknown"}
                    </Link>
                    {log.member_email && (
                      <p className="text-xs text-gray-400 truncate">{log.member_email}</p>
                    )}
                  </div>

                  {/* Notes */}
                  {log.notes && (
                    <span className="text-xs text-gray-400 italic truncate max-w-[160px]">{log.notes}</span>
                  )}

                  {/* Link to member */}
                  {log.member_id && (
                    <Link
                      href={`/admin/members?q=${encodeURIComponent(log.member_name ?? "")}`}
                      className="text-xs text-[#1a56db] hover:underline shrink-0"
                    >
                      View
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

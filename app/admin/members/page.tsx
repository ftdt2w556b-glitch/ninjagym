import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import Badge, { slipStatusVariant, slipStatusLabel } from "@/components/ui/Badge";
import { MEMBERSHIP_TYPES } from "@/lib/pricing";
import CheckInButton from "@/components/admin/CheckInButton";
import DeleteCheckInButton from "@/components/admin/DeleteCheckInButton";
import {
  bangkokToday,
  bangkokStartOfDay,
  bangkokEndOfDay,
  formatBangkokDate,
  formatBangkokTime,
} from "@/lib/timezone";

async function deleteCheckIn(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const { createAdminClient: makeAdmin, createSupabaseServerClient: makeClient } = await import("@/lib/supabase/server");
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const admin = makeAdmin();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) return;
  await admin.from("attendance_logs").delete().eq("id", id);
  revalidatePath("/admin/members");
}

function isPackageActive(r: { membership_type: string; sessions_remaining: number | null; expires_at: string | null }) {
  const mt = MEMBERSHIP_TYPES.find((m) => m.id === r.membership_type);
  if (mt?.timeBased) return !r.expires_at || new Date(r.expires_at) > new Date();
  if (mt?.bulk) return r.sessions_remaining !== null && r.sessions_remaining > 0;
  return r.sessions_remaining === null || r.sessions_remaining > 0;
}

type CheckInPeriod = "today" | "week" | "month";

function getCheckInRange(period: CheckInPeriod): { from: string; to: string } {
  const today = bangkokToday();
  if (period === "today") {
    return { from: bangkokStartOfDay(today), to: bangkokEndOfDay(today) };
  }
  if (period === "week") {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const day = d.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diffToMon);
    const monStr = mon.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
    return { from: bangkokStartOfDay(monStr), to: bangkokEndOfDay(today) };
  }
  const [y, m] = today.split("-");
  return { from: bangkokStartOfDay(`${y}-${m}-01`), to: bangkokEndOfDay(today) };
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; tab?: string; period?: string }>;
}) {
  const { q, status, tab = "members", period = "today" } = await searchParams;
  const admin = createAdminClient();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await admin.from("profiles").select("role, name").eq("id", user!.id).single();
  const isAdminOrOwner = ["admin", "manager", "owner"].includes(profile?.role ?? "");
  const canCheckIn = ["admin", "manager", "owner", "staff"].includes(profile?.role ?? "");

  const tabs = [
    { id: "members",  label: "Members" },
    { id: "checkins", label: "Check-ins" },
  ];

  type MemberRow = {
    id: number; name: string; phone: string | null; email: string | null;
    membership_type: string; kids_count: number | null; kids_names: string | null;
    notes: string | null; slip_status: string; amount_paid: number | null;
    payment_method: string | null; created_at: string; sessions_remaining: number | null;
    expires_at: string | null; pin: string | null;
  };
  type TopUpRow = {
    id: number; parent_member_id: number; membership_type: string;
    sessions_remaining: number | null; slip_status: string; expires_at: string | null; amount_paid: number | null;
  };

  // ── Members tab data ─────────────────────────────────────────
  let members: MemberRow[] | null = null;
  let topUpsByParent = new Map<number, TopUpRow[]>();

  if (tab === "members") {
    let query = admin
      .from("member_registrations")
      .select("id, name, phone, email, membership_type, kids_count, kids_names, notes, slip_status, amount_paid, payment_method, created_at, sessions_remaining, expires_at, pin")
      .is("parent_member_id", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
    if (status) query = query.eq("slip_status", status);

    const { data } = await query;
    members = (data ?? []) as MemberRow[];

    const { data: allTopUps } = await admin
      .from("member_registrations")
      .select("id, parent_member_id, membership_type, sessions_remaining, slip_status, expires_at, amount_paid")
      .not("parent_member_id", "is", null)
      .eq("slip_status", "approved");

    for (const t of (allTopUps ?? []) as TopUpRow[]) {
      if (!topUpsByParent.has(t.parent_member_id)) topUpsByParent.set(t.parent_member_id, []);
      topUpsByParent.get(t.parent_member_id)!.push(t);
    }
  }

  // ── Check-ins tab data ───────────────────────────────────────
  let checkInLogs: { id: number; member_id: number | null; member_name: string | null; member_email: string | null; check_in_at: string; notes: string | null; kids_count: number }[] = [];
  let checkInCount = 0;
  const checkInPeriod = (["today", "week", "month"].includes(period) ? period : "today") as CheckInPeriod;
  const periodLabels: Record<CheckInPeriod, string> = { today: "Today", week: "This Week", month: "This Month" };

  if (tab === "checkins") {
    const { from, to } = getCheckInRange(checkInPeriod);
    let ciQuery = admin
      .from("attendance_logs")
      .select("id, member_id, member_name, member_email, check_in_at, notes, kids_count")
      .gte("check_in_at", from)
      .lte("check_in_at", to)
      .order("check_in_at", { ascending: false })
      .limit(200);

    if (q) ciQuery = ciQuery.ilike("member_name", `%${q}%`);

    const { data } = await ciQuery;
    checkInLogs = (data ?? []) as typeof checkInLogs;
    // Sum kids_count for accurate headcount (old records default to 1)
    checkInCount = checkInLogs.reduce((sum, log) => sum + (log.kids_count ?? 1), 0);
  }

  // Group check-ins by date
  const grouped = new Map<string, typeof checkInLogs>();
  for (const log of checkInLogs) {
    const dateKey = formatBangkokDate(log.check_in_at, { weekday: "short", month: "short", day: "numeric" });
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey)!.push(log);
  }

  const statusOptions = [
    { value: "", label: "All" },
    { value: "pending_review", label: "Pending Review" },
    { value: "cash_pending", label: "Cash Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  const checkInPeriods: { id: CheckInPeriod; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "week",  label: "This Week" },
    { id: "month", label: "This Month" },
  ];

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <a
            key={t.id}
            href={`/admin/members?tab=${t.id}`}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {/* ── Members Tab ── */}
      {tab === "members" && (
        <>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-gray-900">Members</h1>
            <span className="text-sm text-gray-500">{members?.length ?? 0} members</span>
          </div>

          {/* Search + filter */}
          <form method="GET" className="flex gap-2 mb-6 flex-wrap">
            <input type="hidden" name="tab" value="members" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search name, phone, email..."
              className="flex-1 min-w-[200px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            />
            <select
              name="status"
              defaultValue={status}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-[#1a56db] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
            {(q || status) && (
              <Link href="/admin/members?tab=members" className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors">
                Clear
              </Link>
            )}
          </form>

          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Name / Contact</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Active Packages</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Kids</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Amount</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {members?.map((m) => {
                    const primaryLabel = MEMBERSHIP_TYPES.find((t) => t.id === m.membership_type)?.label ?? m.membership_type;
                    const topUps = topUpsByParent.get(m.id) ?? [];

                    return (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{m.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900">{m.name}</p>
                            {m.pin && (
                              <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 font-mono">
                                PIN: {m.pin}
                              </span>
                            )}
                          </div>
                          {m.email && <p className="text-xs text-gray-400">{m.email}</p>}
                          {m.phone && <p className="text-xs text-gray-400">{m.phone}</p>}
                          {m.kids_names && (
                            <p className="text-xs text-blue-600 mt-0.5 font-bold">{m.kids_names}</p>
                          )}
                        </td>

                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex flex-col gap-1">
                            {isPackageActive(m) && (
                              <PackageRow
                                regId={m.id}
                                label={primaryLabel}
                                sessions={m.sessions_remaining}
                                expiresAt={m.expires_at}
                                membershipType={m.membership_type}
                                isPrimary
                                canCheckIn={canCheckIn}
                                staffName={profile?.name ?? undefined}
                              />
                            )}
                            {topUps.filter((t) => isPackageActive(t)).map((t) => {
                              const tLabel = MEMBERSHIP_TYPES.find((mt) => mt.id === t.membership_type)?.label ?? t.membership_type;
                              return (
                                <PackageRow
                                  key={t.id}
                                  regId={t.id}
                                  label={tLabel}
                                  sessions={t.sessions_remaining}
                                  expiresAt={t.expires_at}
                                  membershipType={t.membership_type}
                                  canCheckIn={canCheckIn}
                                  staffName={profile?.name ?? undefined}
                                />
                              );
                            })}
                            {!isPackageActive(m) && topUps.filter((t) => isPackageActive(t)).length === 0 && (
                              <span className="text-xs text-gray-400 italic">No active packages</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 hidden md:table-cell text-gray-600">{m.kids_count}</td>
                        <td className="px-4 py-3">
                          <Badge label={slipStatusLabel(m.slip_status)} variant={slipStatusVariant(m.slip_status)} />
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-gray-600">
                          {m.amount_paid ? `${Number(m.amount_paid).toLocaleString()} THB` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Link
                              href={`/qr/card/${m.id}?from=admin`}
                              className="text-xs text-[#1a56db] hover:underline"
                            >
                              Member Card
                            </Link>
                            {isAdminOrOwner && (
                              <Link
                                href={`/admin/members/${m.id}`}
                                className="text-xs text-gray-500 hover:underline"
                              >
                                Edit
                              </Link>
                            )}
                            {m.slip_status === "pending_review" && (
                              <Link href={`/admin/payments?member=${m.id}`} className="text-xs text-yellow-600 hover:underline">
                                Review
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(!members || members.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-gray-400">No members found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Check-ins Tab ── */}
      {tab === "checkins" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Check-in Records</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {checkInCount} check-in{checkInCount !== 1 ? "s" : ""} — {periodLabels[checkInPeriod]}
              </p>
            </div>
            {/* Period tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {checkInPeriods.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/members?tab=checkins&period=${p.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    checkInPeriod === p.id
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {p.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Name search */}
          <form method="GET" action="/admin/members" className="flex gap-2">
            <input type="hidden" name="tab" value="checkins" />
            <input type="hidden" name="period" value={checkInPeriod} />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Filter by member name..."
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            />
            <button
              type="submit"
              className="bg-[#1a56db] text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
            {q && (
              <Link
                href={`/admin/members?tab=checkins&period=${checkInPeriod}`}
                className="text-sm text-gray-400 hover:text-gray-600 px-3 py-2.5"
              >
                Clear
              </Link>
            )}
          </form>

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
                      <span className="text-sm font-mono text-gray-400 w-12 shrink-0">
                        {formatBangkokTime(log.check_in_at)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/admin/members?tab=members&q=${encodeURIComponent(log.member_name ?? "")}`}
                          className="font-semibold text-gray-800 hover:text-[#1a56db] transition-colors text-sm"
                        >
                          {log.member_name ?? "Unknown"}
                        </Link>
                        {log.member_email && (
                          <p className="text-xs text-gray-400 truncate">{log.member_email}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 italic shrink-0">
                        {log.notes
                          ? log.notes.replace("Manual check-in by staff", "Check-in by staff")
                          : "Check-in at approval"}
                      </span>
                      {log.member_id && (
                        <Link
                          href={`/admin/members?tab=members&q=${encodeURIComponent(log.member_name ?? "")}`}
                          className="text-xs text-[#1a56db] hover:underline shrink-0"
                        >
                          View
                        </Link>
                      )}
                      {isAdminOrOwner && (
                        <DeleteCheckInButton
                          action={deleteCheckIn}
                          id={log.id}
                          memberName={log.member_name ?? "Unknown"}
                          time={formatBangkokTime(log.check_in_at)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function PackageRow({
  regId,
  label,
  sessions,
  expiresAt,
  membershipType,
  isPrimary = false,
  canCheckIn = false,
  staffName,
}: {
  regId?: number;
  label: string;
  sessions: number | null;
  expiresAt: string | null;
  membershipType: string;
  isPrimary?: boolean;
  canCheckIn?: boolean;
  staffName?: string;
}) {
  const isMonthly = membershipType === "monthly_flex";

  let sessionBadge: React.ReactNode = null;
  if (isMonthly && expiresAt) {
    const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
    sessionBadge = (
      <span className={`text-xs font-medium ${daysLeft <= 0 ? "text-red-500" : daysLeft <= 7 ? "text-orange-500" : "text-blue-500"}`}>
        {daysLeft <= 0 ? "Expired" : `${daysLeft}d left`}
      </span>
    );
  } else if (sessions !== null) {
    sessionBadge = (
      <span className={`text-xs font-medium ${sessions <= 1 ? "text-orange-500" : "text-blue-500"}`}>
        {sessions} left
      </span>
    );
  }

  const showCheckIn = canCheckIn && !isMonthly && regId !== undefined;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {!isPrimary && <span className="text-gray-300 text-xs">+</span>}
      <span className={`text-xs ${isPrimary ? "text-gray-700 font-medium" : "text-gray-500"}`}>{label}</span>
      {sessionBadge}
      {showCheckIn && <CheckInButton regId={regId!} label={label} sessionsRemaining={sessions} staffName={staffName} />}
    </div>
  );
}

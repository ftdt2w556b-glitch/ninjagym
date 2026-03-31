import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import Badge, { slipStatusVariant, slipStatusLabel } from "@/components/ui/Badge";
import { MEMBERSHIP_TYPES } from "@/lib/pricing";
import CheckInButton from "@/components/admin/CheckInButton";

function isPackageActive(r: { membership_type: string; sessions_remaining: number | null; expires_at: string | null }) {
  const mt = MEMBERSHIP_TYPES.find((m) => m.id === r.membership_type);
  if (mt?.timeBased) return !r.expires_at || new Date(r.expires_at) > new Date();
  if (mt?.bulk) return r.sessions_remaining !== null && r.sessions_remaining > 0;
  // Single-use: active if sessions_remaining > 0, or null (legacy — hasn't been checked in yet)
  return r.sessions_remaining === null || r.sessions_remaining > 0;
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const admin = createAdminClient();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user!.id).single();
  const isAdminOrOwner = ["admin", "manager", "owner"].includes(profile?.role ?? "");

  // Only primary registrations (no top-ups)
  let query = admin
    .from("member_registrations")
    .select("id, name, phone, email, membership_type, kids_count, kids_names, notes, slip_status, amount_paid, payment_method, created_at, sessions_remaining, expires_at, pin")
    .is("parent_member_id", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  }
  if (status) {
    query = query.eq("slip_status", status);
  }

  const { data: members } = await query;

  // Fetch all top-ups to show package summary per member
  const { data: allTopUps } = await admin
    .from("member_registrations")
    .select("id, parent_member_id, membership_type, sessions_remaining, slip_status, expires_at, amount_paid")
    .not("parent_member_id", "is", null)
    .eq("slip_status", "approved");

  // Group top-ups by parent id
  const topUpsByParent = new Map<number, typeof allTopUps>();
  for (const t of allTopUps ?? []) {
    const pid = t.parent_member_id as number;
    if (!topUpsByParent.has(pid)) topUpsByParent.set(pid, []);
    topUpsByParent.get(pid)!.push(t);
  }

  const statusOptions = [
    { value: "", label: "All" },
    { value: "pending_review", label: "Pending Review" },
    { value: "cash_pending", label: "Cash Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Members</h1>
        <span className="text-sm text-gray-500">{members?.length ?? 0} members</span>
      </div>

      {/* Search + filter */}
      <form method="GET" className="flex gap-2 mb-6 flex-wrap">
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
          <Link href="/admin/members" className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors">
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
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

                    {/* Active packages column */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex flex-col gap-1">
                        {/* Primary package — only if active */}
                        {isPackageActive({ membership_type: m.membership_type, sessions_remaining: m.sessions_remaining, expires_at: m.expires_at ?? null }) && (
                          <PackageRow
                            regId={m.id}
                            label={primaryLabel}
                            sessions={m.sessions_remaining}
                            expiresAt={m.expires_at ?? null}
                            membershipType={m.membership_type}
                            isPrimary
                            canCheckIn={isAdminOrOwner}
                          />
                        )}
                        {/* Active top-up packages */}
                        {topUps.filter((t) => isPackageActive(t)).map((t) => {
                          const tLabel = MEMBERSHIP_TYPES.find((mt) => mt.id === t.membership_type)?.label ?? t.membership_type;
                          return (
                            <PackageRow
                              key={t.id}
                              regId={t.id}
                              label={tLabel}
                              sessions={t.sessions_remaining}
                              expiresAt={t.expires_at ?? null}
                              membershipType={t.membership_type}
                              canCheckIn={isAdminOrOwner}
                            />
                          );
                        })}
                        {/* Fallback when no active packages */}
                        {!isPackageActive({ membership_type: m.membership_type, sessions_remaining: m.sessions_remaining, expires_at: m.expires_at ?? null }) &&
                         topUps.filter((t) => isPackageActive(t)).length === 0 && (
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
}: {
  regId?: number;
  label: string;
  sessions: number | null;
  expiresAt: string | null;
  membershipType: string;
  isPrimary?: boolean;
  canCheckIn?: boolean;
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

  // Show Check In for single-use and bulk packages (not time-based like monthly_flex)
  const showCheckIn = canCheckIn && !isMonthly && regId !== undefined;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {!isPrimary && <span className="text-gray-300 text-xs">+</span>}
      <span className={`text-xs ${isPrimary ? "text-gray-700 font-medium" : "text-gray-500"}`}>{label}</span>
      {sessionBadge}
      {showCheckIn && <CheckInButton regId={regId!} label={label} />}
    </div>
  );
}

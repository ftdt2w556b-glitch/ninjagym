import { createAdminClient } from "@/lib/supabase/server";
import Link from "next/link";
import Badge, { slipStatusVariant, slipStatusLabel } from "@/components/ui/Badge";
import { MEMBERSHIP_TYPES } from "@/lib/pricing";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from("member_registrations")
    .select("id, name, phone, email, membership_type, kids_count, kids_names, notes, slip_status, amount_paid, payment_method, created_at, sessions_remaining, expires_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  }
  if (status) {
    query = query.eq("slip_status", status);
  }

  const { data: members } = await query;

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
        <span className="text-sm text-gray-500">{members?.length ?? 0} records</span>
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
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Membership</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Kids</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members?.map((m) => {
                const typeLabel = MEMBERSHIP_TYPES.find((t) => t.id === m.membership_type)?.label ?? m.membership_type;
                return (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{m.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{m.name}</p>
                      {m.email && <p className="text-xs text-gray-400">{m.email}</p>}
                      {m.phone && <p className="text-xs text-gray-400">{m.phone}</p>}
                      {(m as { kids_names?: string }).kids_names && (
                        <p className="text-xs text-blue-600 mt-0.5 font-bold">{(m as { kids_names?: string }).kids_names}</p>
                      )}
                      {(m as { notes?: string }).notes && (
                        <p className="text-xs text-orange-500 mt-0.5 italic">📝 {(m as { notes?: string }).notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-600">
                      <p>{typeLabel}</p>
                      {m.sessions_remaining !== null && (
                        <p className="text-xs text-blue-500">{m.sessions_remaining} sessions left</p>
                      )}
                      {(m as { expires_at?: string | null }).expires_at && (() => {
                        const exp = new Date((m as { expires_at: string }).expires_at);
                        const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86400000);
                        return (
                          <p className={`text-xs font-medium ${daysLeft <= 0 ? "text-red-500" : daysLeft <= 7 ? "text-orange-500" : "text-gray-400"}`}>
                            {daysLeft <= 0 ? "⛔ Expired" : daysLeft <= 7 ? `⚠️ Expires in ${daysLeft}d` : `Until ${exp.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                          </p>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-600">{m.kids_count}</td>
                    <td className="px-4 py-3">
                      <Badge label={slipStatusLabel(m.slip_status)} variant={slipStatusVariant(m.slip_status)} />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-600">
                      {m.amount_paid ? `${Number(m.amount_paid).toLocaleString()} THB` : "-"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-400">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/qr/card/${m.id}?from=admin`}
                          className="text-xs text-[#1a56db] hover:underline"
                        >
                          QR Card
                        </Link>
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
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">No members found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

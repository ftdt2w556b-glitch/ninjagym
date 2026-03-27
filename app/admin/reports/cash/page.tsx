import { createAdminClient } from "@/lib/supabase/server";

export default async function CashReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const admin = createAdminClient();

  const today = new Date().toISOString().split("T")[0];
  const dateFrom = from ?? today;
  const dateTo = to ?? today;

  const { data: sales } = await admin
    .from("cash_sales")
    .select("*, profiles(name, email)")
    .gte("processed_at", `${dateFrom}T00:00:00`)
    .lte("processed_at", `${dateTo}T23:59:59`)
    .order("processed_at", { ascending: false });

  const total = sales?.reduce((sum, s) => sum + Number(s.amount), 0) ?? 0;

  const byType = sales?.reduce((acc, s) => {
    const key = s.sale_type ?? "other";
    acc[key] = (acc[key] ?? 0) + Number(s.amount);
    return acc;
  }, {} as Record<string, number>) ?? {};

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Cash Report</h1>
        <a
          href={`/api/reports/cash/export?from=${dateFrom}&to=${dateTo}`}
          className="bg-[#1a56db] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
        >
          Export CSV
        </a>
      </div>

      {/* Date filter */}
      <form method="GET" className="flex gap-3 mb-6 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" name="from" defaultValue={dateFrom}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" name="to" defaultValue={dateTo}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]" />
        </div>
        <div className="flex items-end">
          <button type="submit"
            className="bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors">
            Filter
          </button>
        </div>
      </form>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        <div className="bg-[#1a56db] text-white rounded-2xl p-4">
          <p className="text-sm opacity-80">Total Sales</p>
          <p className="font-fredoka text-2xl">{total.toLocaleString()} THB</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow">
          <p className="text-sm text-gray-500">Transactions</p>
          <p className="font-bold text-2xl text-gray-900">{sales?.length ?? 0}</p>
        </div>
        {Object.entries(byType).map(([type, amount]) => (
          <div key={type} className="bg-white rounded-2xl p-4 shadow">
            <p className="text-sm text-gray-500 capitalize">{type}</p>
            <p className="font-bold text-lg text-gray-900">{Number(amount).toLocaleString()} THB</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Time</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Staff</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sales?.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(s.processed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">{s.sale_type ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {Number(s.amount).toLocaleString()} THB
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-500">
                    {(s.profiles as { name?: string; email?: string } | null)?.name ??
                     (s.profiles as { name?: string; email?: string } | null)?.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-gray-400">{s.notes ?? "—"}</td>
                </tr>
              ))}
              {(!sales || sales.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">No sales for this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

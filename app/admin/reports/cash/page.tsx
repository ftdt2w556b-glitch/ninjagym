import { createAdminClient } from "@/lib/supabase/server";
import Link from "next/link";

type Mode = "day" | "month" | "year";

function buildRange(mode: Mode, date: string): { from: string; to: string; label: string } {
  if (mode === "day") {
    return {
      from: `${date}T00:00:00`,
      to:   `${date}T23:59:59`,
      label: new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase(),
    };
  }
  if (mode === "month") {
    const [y, m] = date.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const mm = String(m).padStart(2, "0");
    return {
      from: `${y}-${mm}-01T00:00:00`,
      to:   `${y}-${mm}-${lastDay}T23:59:59`,
      label: new Date(y, m - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase(),
    };
  }
  const y = date;
  return {
    from: `${y}-01-01T00:00:00`,
    to:   `${y}-12-31T23:59:59`,
    label: `YEAR ${y}`,
  };
}

function defaultDate(mode: Mode): string {
  const now = new Date();
  if (mode === "day")   return now.toISOString().split("T")[0];
  if (mode === "month") return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return String(now.getFullYear());
}

function inputType(mode: Mode) {
  if (mode === "day")   return "date";
  if (mode === "month") return "month";
  return "number";
}

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string }>;
}) {
  const { mode: rawMode, date: rawDate } = await searchParams;
  const mode: Mode = (rawMode === "month" || rawMode === "year") ? rawMode : "day";
  const date = rawDate ?? defaultDate(mode);
  const { from, to, label } = buildRange(mode, date);

  const admin = createAdminClient();

  // POS / walk-in cash sales — include staff_name for attribution
  const { data: cashSales } = await admin
    .from("cash_sales")
    .select("id, amount, payment_method, processed_at, sale_type, notes, staff_name, profiles(name)")
    .gte("processed_at", from)
    .lte("processed_at", to)
    .order("processed_at", { ascending: false });

  // Approved member registrations (by approval date)
  const { data: memberPayments } = await admin
    .from("member_registrations")
    .select("id, name, amount_paid, payment_method, slip_reviewed_at, membership_type, notes")
    .eq("slip_status", "approved")
    .gte("slip_reviewed_at", from)
    .lte("slip_reviewed_at", to)
    .order("slip_reviewed_at", { ascending: false });

  // Unified transaction list
  type TxRow = {
    time: string;
    description: string;
    method: string;
    amount: number;
    source: "pos" | "registration";
    staff: string | null;
    isWalkin: boolean;
  };

  const allTx: TxRow[] = [
    ...(cashSales ?? []).map((s) => {
      const profileName = Array.isArray(s.profiles)
        ? (s.profiles[0] as { name?: string } | undefined)?.name ?? null
        : (s.profiles as { name?: string } | null)?.name ?? null;
      return {
        time: s.processed_at as string,
        description: s.notes ?? s.sale_type ?? "POS Sale",
        method: (s.payment_method as string | null) ?? "cash",
        amount: Number(s.amount),
        source: "pos" as const,
        staff: s.staff_name ?? profileName,
        isWalkin: (s.notes as string | null)?.includes("Walk-in") ?? false,
      };
    }),
    ...(memberPayments ?? []).map((m) => ({
      time: m.slip_reviewed_at ?? "",
      description: `${m.name}${m.notes ? ` — ${m.notes}` : ""}`,
      method: m.payment_method ?? "cash",
      amount: Number(m.amount_paid ?? 0),
      source: "registration" as const,
      staff: null,
      isWalkin: (m.notes as string | null)?.includes("Walk-in") ?? false,
    })),
  ].sort((a, b) => b.time.localeCompare(a.time));

  // ── Totals ──────────────────────────────────────────────────────────
  const cashTotal      = allTx.filter((t) => t.method === "cash").reduce((s, t) => s + t.amount, 0);
  const transferTotal  = allTx.filter((t) => t.method !== "cash").reduce((s, t) => s + t.amount, 0);
  const grandTotal     = cashTotal + transferTotal;
  const cashCount      = allTx.filter((t) => t.method === "cash").length;
  const transferCount  = allTx.filter((t) => t.method !== "cash").length;
  const walkinCount    = allTx.filter((t) => t.isWalkin).length;

  // ── Staff breakdown (cash only — the accountability view) ───────────
  const staffMap = new Map<string, { total: number; count: number }>();
  for (const tx of allTx) {
    if (tx.method !== "cash") continue;
    const key = tx.staff ?? "⚠️ Unattributed";
    const existing = staffMap.get(key) ?? { total: 0, count: 0 };
    staffMap.set(key, { total: existing.total + tx.amount, count: existing.count + 1 });
  }
  const staffBreakdown = [...staffMap.entries()]
    .sort((a, b) => b[1].total - a[1].total);
  const hasUnattributed = staffMap.has("⚠️ Unattributed");

  const exportUrl = `/api/reports/cash/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales & Cash Report</h1>
          <p className="text-sm text-gray-400 mt-0.5">All approved payments · cash attributed by staff</p>
        </div>
        <a
          href={exportUrl}
          className="bg-[#22c55e] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-green-600 transition-colors"
        >
          Export CSV
        </a>
      </div>

      {/* Mode toggle + date */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
          {(["day", "month", "year"] as Mode[]).map((m) => (
            <Link
              key={m}
              href={`?mode=${m}&date=${defaultDate(m)}`}
              className={`px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                mode === m ? "bg-[#1a56db] text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {m === "day" ? "Day" : m === "month" ? "Month" : "Year"}
            </Link>
          ))}
        </div>
        <form method="GET" className="flex gap-2 items-end">
          <input type="hidden" name="mode" value={mode} />
          <input
            type={inputType(mode)}
            name="date"
            defaultValue={date}
            min={mode === "year" ? "2020" : undefined}
            max={mode === "year" ? "2100" : undefined}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
          />
          <button
            type="submit"
            className="bg-[#1a56db] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Go
          </button>
        </form>
      </div>

      <p className="text-sm font-bold text-gray-700 mb-4">{label}</p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-3xl font-bold text-green-600">฿{cashTotal.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">Cash ({cashCount} payments)</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-3xl font-bold text-[#1a56db]">฿{transferTotal.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">Transfer / PromptPay ({transferCount})</p>
        </div>
        <div className="rounded-2xl p-5 text-white bg-gray-800">
          <p className="text-3xl font-bold">฿{grandTotal.toLocaleString()}</p>
          <p className="text-sm opacity-80 mt-1">Grand Total · {walkinCount} walk-ins</p>
        </div>
      </div>

      {/* ── Staff cash breakdown ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow mb-6 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Cash by Staff</h2>
            <p className="text-xs text-gray-400 mt-0.5">Who collected what — cross-check against physical drawer</p>
          </div>
          {hasUnattributed && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">
              ⚠️ Unattributed cash
            </span>
          )}
        </div>
        {staffBreakdown.length === 0 ? (
          <p className="px-5 py-6 text-gray-400 text-sm">No cash transactions for this period.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {staffBreakdown.map(([name, { total, count }]) => {
              const isUnattributed = name === "⚠️ Unattributed";
              const pct = cashTotal > 0 ? (total / cashTotal) * 100 : 0;
              return (
                <div key={name} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-semibold text-sm ${isUnattributed ? "text-red-600" : "text-gray-800"}`}>
                        {name}
                      </span>
                      <span className="text-xs text-gray-400">{count} payment{count !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isUnattributed ? "bg-red-400" : "bg-green-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className={`font-bold text-lg tabular-nums ${isUnattributed ? "text-red-600" : "text-gray-900"}`}>
                    ฿{total.toLocaleString()}
                  </span>
                </div>
              );
            })}
            {/* Total row */}
            <div className="px-5 py-3 flex items-center justify-between bg-gray-50">
              <span className="text-sm font-semibold text-gray-600">Total cash expected in drawer</span>
              <span className="font-bold text-lg text-gray-900">฿{cashTotal.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Transactions table ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">All Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Time</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Member / Description</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Staff</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Method</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allTx.map((tx, i) => (
                <tr key={i} className={`hover:bg-gray-50 ${tx.isWalkin ? "bg-green-50/40" : ""}`}>
                  <td className="px-4 py-3 text-gray-400 tabular-nums whitespace-nowrap">
                    {tx.time
                      ? new Date(tx.time).toLocaleString("en-US", {
                          month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                    <span className="line-clamp-1">{tx.description}</span>
                    {tx.isWalkin && (
                      <span className="text-xs text-green-600 font-medium">Walk-in</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {tx.staff ? (
                      <span className="text-gray-700 text-sm">{tx.staff}</span>
                    ) : (
                      <span className="text-gray-300 text-xs italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      tx.method === "cash"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {tx.method === "cash" ? "Cash" : "PromptPay"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900 text-right tabular-nums">
                    ฿{tx.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
              {allTx.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    No payments recorded for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

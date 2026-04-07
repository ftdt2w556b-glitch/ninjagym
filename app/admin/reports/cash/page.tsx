import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { bangkokToday } from "@/lib/timezone";
import VoidTransactionButton from "@/components/admin/VoidTransactionButton";
import ExpensesSection, { type Expense } from "@/components/admin/ExpensesSection";

async function voidTransaction(formData: FormData) {
  "use server";
  const id     = formData.get("id") as string;
  const source = formData.get("source") as string;
  const { createAdminClient: makeAdmin, createSupabaseServerClient: makeClient } = await import("@/lib/supabase/server");
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const admin = makeAdmin();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) return;

  if (source === "member") {
    await admin.from("member_registrations").update({ slip_status: "rejected" }).eq("id", Number(id));
    const { data: linkedSales } = await admin.from("cash_sales").select("id").eq("reference_id", Number(id)).eq("sale_type", "membership");
    for (const s of linkedSales ?? []) {
      await admin.from("drawer_log").delete().eq("sale_id", s.id);
      await admin.from("cash_sales").delete().eq("id", s.id);
    }
  } else if (source === "cash_sale") {
    await admin.from("drawer_log").delete().eq("sale_id", Number(id));
    await admin.from("cash_sales").delete().eq("id", Number(id));
  }
  revalidatePath("/admin/reports/cash");
}

type Mode = "day" | "month" | "year";

function buildRange(mode: Mode, date: string): { from: string; to: string; label: string } {
  if (mode === "day") {
    return {
      from: `${date}T00:00:00+07:00`,
      to:   `${date}T23:59:59+07:00`,
      label: new Date(date + "T12:00:00+07:00").toLocaleDateString("en-US", { timeZone: "Asia/Bangkok", weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase(),
    };
  }
  if (mode === "month") {
    const [y, m] = date.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const mm = String(m).padStart(2, "0");
    return {
      from: `${y}-${mm}-01T00:00:00+07:00`,
      to:   `${y}-${mm}-${lastDay}T23:59:59+07:00`,
      label: new Date(y, m - 1).toLocaleDateString("en-US", { timeZone: "Asia/Bangkok", month: "long", year: "numeric" }).toUpperCase(),
    };
  }
  const y = date;
  return {
    from: `${y}-01-01T00:00:00+07:00`,
    to:   `${y}-12-31T23:59:59+07:00`,
    label: `YEAR ${y}`,
  };
}

function defaultDate(mode: Mode): string {
  const now = new Date();
  if (mode === "day")   return bangkokToday();
  if (mode === "month") {
    const d = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return String(new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })).getFullYear());
}

function inputType(mode: Mode) {
  if (mode === "day")   return "date";
  if (mode === "month") return "month";
  return "number";
}

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string; method?: string }>;
}) {
  const { mode: rawMode, date: rawDate, method: rawMethod } = await searchParams;
  const mode: Mode = (rawMode === "month" || rawMode === "year") ? rawMode : "day";
  const date = rawDate ?? defaultDate(mode);
  const methodFilter = rawMethod === "cash" ? "cash" : rawMethod === "promptpay" ? "promptpay" : "";
  const { from, to, label } = buildRange(mode, date);

  const admin = createAdminClient();

  // Only admin, manager, and owner may view sales reports
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentProfile } = await admin.from("profiles").select("role").eq("id", user!.id).single();
  if (!["admin", "manager", "owner"].includes(currentProfile?.role ?? "")) redirect("/admin/dashboard");

  const canEdit = ["admin", "manager"].includes(currentProfile?.role ?? "");
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  // ── Income queries ────────────────────────────────────────────────────
  // ALL POS cash sales — single source of truth for cash
  const { data: cashSales } = await admin
    .from("cash_sales")
    .select("id, amount, processed_at, sale_type, notes, staff_name, reference_id")
    .gte("processed_at", from)
    .lte("processed_at", to)
    .order("processed_at", { ascending: false });

  // Approved non-cash registrations (PromptPay only — cash excluded, counted via cash_sales)
  const { data: memberPayments } = await admin
    .from("member_registrations")
    .select("id, name, amount_paid, payment_method, slip_reviewed_at, membership_type, notes, slip_image")
    .eq("slip_status", "approved")
    .neq("payment_method", "cash")
    .gte("slip_reviewed_at", from)
    .lte("slip_reviewed_at", to)
    .order("slip_reviewed_at", { ascending: false });

  // ── Expenses for this period ──────────────────────────────────────────
  const fromDate = from.split("T")[0];
  const toDate   = to.split("T")[0];
  const { data: expensesRaw } = await admin
    .from("expenses")
    .select("*")
    .eq("voided", false)
    .gte("expense_date", fromDate)
    .lte("expense_date", toDate)
    .order("expense_date", { ascending: false })
    .order("created_at",   { ascending: false });

  const expenses: Expense[] = (expensesRaw ?? []) as Expense[];
  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

  // ── Unified transaction list ──────────────────────────────────────────
  type TxRow = {
    id: number;
    source: "member" | "cash_sale";
    time: string;
    description: string;
    method: string;
    amount: number;
    slipImage?: string | null;
  };

  const allTx: TxRow[] = [
    ...(cashSales ?? []).map((s) => ({
      id: s.id as number,
      source: "cash_sale" as const,
      time: s.processed_at as string,
      description: (s.notes as string | null) ??
        (s.sale_type === "membership"
          ? `POS Membership${s.staff_name ? ` · ${s.staff_name}` : ""}`
          : s.sale_type ?? "POS Sale"),
      method: "cash",
      amount: Number(s.amount),
    })),
    ...(memberPayments ?? []).map((m) => ({
      id: m.id as number,
      source: "member" as const,
      time: m.slip_reviewed_at ?? "",
      description: `${m.name}`,
      method: m.payment_method ?? "cash",
      amount: Number(m.amount_paid ?? 0),
      slipImage: m.slip_image as string | null,
    })),
  ].sort((a, b) => b.time.localeCompare(a.time));

  // ── Totals ────────────────────────────────────────────────────────────
  const cashTotal     = allTx.filter((t) => t.method === "cash").reduce((s, t) => s + t.amount, 0);
  const transferTotal = allTx.filter((t) => t.method !== "cash").reduce((s, t) => s + t.amount, 0);
  const grandTotal    = cashTotal + transferTotal;
  const netTotal      = grandTotal - expenseTotal;
  const cashCount     = allTx.filter((t) => t.method === "cash").length;
  const transferCount = allTx.filter((t) => t.method !== "cash").length;

  const visibleTx = methodFilter === "cash"
    ? allTx.filter((t) => t.method === "cash")
    : methodFilter === "promptpay"
    ? allTx.filter((t) => t.method !== "cash")
    : allTx;

  const exportUrl = `/api/reports/cash/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales & Cash Report</h1>
          <p className="text-sm text-gray-400 mt-0.5">All approved payments · cash attributed by staff</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/admin/receipt/all?mode=${mode}&date=${dateParam}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#1a56db] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
          >
            All Receipts (PDF)
          </a>
          <a
            href={exportUrl}
            className="bg-[#22c55e] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-green-600 transition-colors"
          >
            Export CSV
          </a>
        </div>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-2xl font-bold text-green-600">฿{cashTotal.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">Cash ({cashCount} payments)</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-2xl font-bold text-[#1a56db]">฿{transferTotal.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">PromptPay ({transferCount} payments)</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-2xl font-bold text-red-500">−฿{expenseTotal.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">Expenses ({expenses.length})</p>
        </div>
        <div className={`rounded-2xl p-5 text-white ${netTotal >= 0 ? "bg-gray-800" : "bg-red-700"}`}>
          <p className="text-2xl font-bold">฿{netTotal.toLocaleString()}</p>
          <p className="text-sm opacity-80 mt-1">Net · {allTx.length} transactions</p>
        </div>
      </div>

      {/* ── Transactions table ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-bold text-gray-900">
            {methodFilter === "cash" ? "Cash Transactions" : methodFilter === "promptpay" ? "PromptPay Transactions" : "All Transactions"}
            <span className="ml-2 text-sm font-normal text-gray-400">({visibleTx.length})</span>
          </h2>
          <div className="flex gap-1">
            {[
              { value: "",          label: "All" },
              { value: "cash",      label: "Cash" },
              { value: "promptpay", label: "PromptPay" },
            ].map((opt) => (
              <Link
                key={opt.value}
                href={`?mode=${mode}&date=${date}${opt.value ? `&method=${opt.value}` : ""}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  methodFilter === opt.value
                    ? "bg-[#1a56db] text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Time</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Member / Description</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Method</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Slip</th>
                <th className="px-4 py-3" />
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibleTx.map((tx, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 tabular-nums whitespace-nowrap">
                    {tx.time ? new Date(tx.time).toLocaleString("en-US", { timeZone: "Asia/Bangkok", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[260px]">
                    <span className="line-clamp-1">{tx.description}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      tx.method === "cash" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {tx.method === "cash" ? "Cash" : "PromptPay"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900 text-right tabular-nums">
                    ฿{tx.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {tx.slipImage ? (
                      <a
                        href={`${SUPABASE_URL}/storage/v1/object/public/slips/${tx.slipImage}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View payment slip"
                      >
                        <img
                          src={`${SUPABASE_URL}/storage/v1/object/public/slips/${tx.slipImage}`}
                          alt="slip"
                          className="w-10 h-10 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ) : (
                      <span className="text-gray-200 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/admin/receipt/${tx.source}/${tx.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View receipt"
                      className="text-gray-400 hover:text-blue-600 transition-colors text-xs"
                    >
                      🧾
                    </a>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <VoidTransactionButton
                        action={voidTransaction}
                        id={tx.id}
                        source={tx.source}
                        description={tx.description}
                        amount={tx.amount}
                      />
                    </td>
                  )}
                </tr>
              ))}
              {visibleTx.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="px-4 py-10 text-center text-gray-400">
                    No payments recorded for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Expenses section ─────────────────────────────────────────────── */}
      <ExpensesSection
        initialExpenses={expenses}
        from={from}
        to={to}
        supabaseUrl={SUPABASE_URL}
        canEdit={canEdit}
      />

      {/* ── Net summary footer ───────────────────────────────────────────── */}
      {expenseTotal > 0 && (
        <div className="mt-4 bg-gray-50 rounded-2xl px-5 py-4 flex flex-wrap gap-6 text-sm">
          <span className="text-gray-600">Income: <strong className="text-gray-900">฿{grandTotal.toLocaleString()}</strong></span>
          <span className="text-gray-600">Expenses: <strong className="text-red-600">−฿{expenseTotal.toLocaleString()}</strong></span>
          <span className="text-gray-800 font-bold">Net: ฿{netTotal.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

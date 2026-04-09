import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";

// ── Server Actions ────────────────────────────────────────────────────────────

async function addExpenseAction(formData: FormData) {
  "use server";
  const { createAdminClient: makeAdmin, createSupabaseServerClient: makeClient } =
    await import("@/lib/supabase/server");
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const admin = makeAdmin();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) return;

  const { data: company } = await admin.from("companies").select("id").limit(1).single();
  if (!company) return;

  const supplierName      = formData.get("supplier_name") as string;
  const supplierTaxId     = (formData.get("supplier_tax_id") as string) || null;
  const supplierInvoiceNo = (formData.get("supplier_invoice_no") as string) || null;
  const issueDate         = formData.get("issue_date") as string;
  const category          = formData.get("category") as string;
  const beforeVatAmount   = parseFloat(formData.get("before_vat_amount") as string);
  const vatRate           = parseFloat(formData.get("vat_rate") as string);
  const isVatClaimable    = formData.get("is_vat_claimable") === "true";
  const description       = (formData.get("description") as string) || null;
  const whtDeducted       = formData.get("wht_deducted") === "true";
  const whtAmountRaw      = formData.get("wht_amount") as string;
  const whtAmount         = whtDeducted && whtAmountRaw ? parseFloat(whtAmountRaw) : null;

  const vatAmount   = Math.round(beforeVatAmount * vatRate / 100 * 100) / 100;
  const totalAmount = Math.round((beforeVatAmount + vatAmount) * 100) / 100;

  const [year, month] = issueDate.split("-").map(Number);
  const periodStart = `${issueDate.substring(0, 7)}-01`;
  const lastDay     = new Date(year, month, 0).getDate();
  const periodEnd   = `${issueDate.substring(0, 7)}-${lastDay}`;

  // Get or create tax period
  const { data: existingPeriod } = await admin
    .from("tax_periods")
    .select("id")
    .eq("company_id", company.id)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  let periodId = existingPeriod?.id ?? null;
  if (!periodId) {
    const { data: newPeriod } = await admin
      .from("tax_periods")
      .insert({
        company_id:   company.id,
        year,
        month,
        period_start: periodStart,
        period_end:   periodEnd,
        pp30_status:  "open",
        pnd3_status:  "open",
        pnd53_status: "open",
      })
      .select("id")
      .single();
    periodId = newPeriod?.id ?? null;
  }

  await admin.from("expense_invoices").insert({
    company_id:         company.id,
    tax_period_id:      periodId,
    supplier_name:      supplierName,
    supplier_tax_id:    supplierTaxId,
    supplier_invoice_no: supplierInvoiceNo,
    issue_date:         issueDate,
    category,
    before_vat_amount:  beforeVatAmount,
    vat_rate:           vatRate,
    vat_amount:         vatAmount,
    total_amount:       totalAmount,
    is_vat_claimable:   isVatClaimable,
    description,
    wht_deducted:       whtDeducted,
    wht_amount:         whtAmount,
    status:             "received",
    created_by:         user.email ?? user.id,
  });

  revalidatePath("/admin/tax");
}

async function addWhtAction(formData: FormData) {
  "use server";
  const { createAdminClient: makeAdmin, createSupabaseServerClient: makeClient } =
    await import("@/lib/supabase/server");
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const admin = makeAdmin();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) return;

  const { data: company } = await admin.from("companies").select("id").limit(1).single();
  if (!company) return;

  const pndType        = formData.get("pnd_type") as string;
  const payeeName      = formData.get("payee_name") as string;
  const payeeTaxId     = formData.get("payee_tax_id") as string;
  const incomeTypeCode = formData.get("income_type_code") as string;
  const paymentDate    = formData.get("payment_date") as string;
  const paymentAmount  = parseFloat(formData.get("payment_amount") as string);
  const whtRate        = parseFloat(formData.get("wht_rate") as string);
  const certNumber     = (formData.get("certificate_number") as string) || null;
  const notes          = (formData.get("notes") as string) || null;

  const whtAmount  = Math.round(paymentAmount * whtRate / 100 * 100) / 100;
  const netPayment = Math.round((paymentAmount - whtAmount) * 100) / 100;

  const [year, month] = paymentDate.split("-").map(Number);
  const periodStart = `${paymentDate.substring(0, 7)}-01`;
  const lastDay     = new Date(year, month, 0).getDate();
  const periodEnd   = `${paymentDate.substring(0, 7)}-${lastDay}`;

  const { data: existingPeriod } = await admin
    .from("tax_periods")
    .select("id")
    .eq("company_id", company.id)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  let periodId = existingPeriod?.id ?? null;
  if (!periodId) {
    const { data: newPeriod } = await admin
      .from("tax_periods")
      .insert({
        company_id:   company.id,
        year,
        month,
        period_start: periodStart,
        period_end:   periodEnd,
        pp30_status:  "open",
        pnd3_status:  "open",
        pnd53_status: "open",
      })
      .select("id")
      .single();
    periodId = newPeriod?.id ?? null;
  }

  await admin.from("withholding_tax_records").insert({
    company_id:            company.id,
    tax_period_id:         periodId,
    pnd_type:              pndType,
    payee_name:            payeeName,
    payee_tax_id:          payeeTaxId,
    income_type_code:      incomeTypeCode,
    payment_date:          paymentDate,
    payment_amount:        paymentAmount,
    wht_rate:              whtRate,
    wht_amount:            whtAmount,
    net_payment:           netPayment,
    certificate_number:    certNumber,
    notes,
    filed:                 false,
    created_by:            user.email ?? user.id,
  });

  revalidatePath("/admin/tax");
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INCOME_TYPES: Record<string, string> = {
  "1": "ม.40(1) Salary / Wages",
  "2": "ม.40(2) Professional Fees",
  "3": "ม.40(3) Royalties",
  "4": "ม.40(4) Interest / Dividends",
  "5": "ม.40(5) Rental Income",
  "6": "ม.40(6) Medical / Legal Prof.",
  "7": "ม.40(7) Contractor / Construction",
  "8": "ม.40(8) Other Income",
};

const CATEGORIES: Record<string, string> = {
  utilities:            "Utilities (Electric, Water, Internet)",
  rent:                 "Rent / Lease",
  salary:               "Salary / Wages",
  professional_service: "Professional Services",
  marketing:            "Marketing & Advertising",
  it_service:           "IT / Software / Subscriptions",
  maintenance:          "Maintenance & Repairs",
  supplies:             "Office & Gym Supplies",
  travel:               "Travel & Transport",
  insurance:            "Insurance",
  other:                "Other",
};

type Tab = "vat" | "expenses" | "wht" | "export";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TaxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; month?: string }>;
}) {
  const { tab: rawTab, month: rawMonth } = await searchParams;
  const tab: Tab = (["vat", "expenses", "wht", "export"] as Tab[]).includes(rawTab as Tab)
    ? (rawTab as Tab)
    : "vat";

  const nowBkk    = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const defMonth  = `${nowBkk.getFullYear()}-${String(nowBkk.getMonth() + 1).padStart(2, "0")}`;
  const month     = rawMonth ?? defMonth;
  const [year, monthNum] = month.split("-").map(Number);

  const supabase = await createSupabaseServerClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user!.id).single();
  if (!["admin", "owner", "tax"].includes(profile?.role ?? "")) redirect("/admin/dashboard");
  // Accountants can view everything but cannot add/edit records
  const canEdit = ["admin", "owner"].includes(profile?.role ?? "");

  const { data: company } = await admin
    .from("companies")
    .select("id, name, tax_id")
    .limit(1)
    .single();
  if (!company) return <div className="p-8 text-red-500">No company record found.</div>;

  const periodStart = `${month}-01`;
  const periodEnd   = new Date(year, monthNum, 0).toISOString().split("T")[0];

  // ── Fetch data per tab ──────────────────────────────────────────────────────

  let vatReport:   any[]  | null = null;
  let taxInvoices: any[]  | null = null;
  let expenses:    any[]  | null = null;
  let whtRecords:  any[]  | null = null;

  if (tab === "vat" || tab === "export") {
    const [vatRes, invRes] = await Promise.all([
      admin.rpc("get_monthly_vat_report", {
        p_company_id: company.id,
        p_year:       year,
        p_month:      monthNum,
      }),
      admin
        .from("tax_invoices")
        .select("id, invoice_number, issue_date, customer_name, customer_tax_id, before_vat_amount, vat_rate, vat_amount, total_amount, payment_method, status")
        .eq("company_id", company.id)
        .eq("type", "sale")
        .gte("issue_date", periodStart)
        .lte("issue_date", periodEnd)
        .not("status", "in", '("void","cancelled")')
        .order("invoice_number", { ascending: false })
        .limit(200),
    ]);
    vatReport   = (vatRes.data ?? []) as any[];
    taxInvoices = invRes.data ?? [];
  }

  if (tab === "expenses") {
    const { data } = await admin
      .from("expense_invoices")
      .select("id, supplier_name, supplier_tax_id, supplier_invoice_no, issue_date, category, before_vat_amount, vat_rate, vat_amount, total_amount, is_vat_claimable, description, wht_deducted, wht_amount, status")
      .eq("company_id", company.id)
      .gte("issue_date", periodStart)
      .lte("issue_date", periodEnd)
      .order("issue_date", { ascending: false });
    expenses = data ?? [];
  }

  if (tab === "wht") {
    const { data } = await admin
      .from("withholding_tax_records")
      .select("id, pnd_type, payee_name, payee_tax_id, income_type_code, payment_date, payment_amount, wht_rate, wht_amount, net_payment, certificate_number, filed, notes")
      .eq("company_id", company.id)
      .gte("payment_date", periodStart)
      .lte("payment_date", periodEnd)
      .order("payment_date", { ascending: false });
    whtRecords = data ?? [];
  }

  // ── Derived totals ──────────────────────────────────────────────────────────

  const outputRow = vatReport?.find((r) => r.section === "OUTPUT" && r.line_no === 1);
  const inputRow  = vatReport?.find((r) => r.section === "INPUT");
  const netRow    = vatReport?.find((r) => r.section === "NET");

  const outputVat   = Number(outputRow?.vat_amount  ?? 0);
  const inputVat    = Number(inputRow?.vat_amount   ?? 0);
  const netVat      = Number(netRow?.vat_amount     ?? 0);
  const outputBase  = Number(outputRow?.base_amount ?? 0);
  const invoiceCnt  = Number(outputRow?.invoice_count ?? 0);

  const expTotalAmt   = (expenses ?? []).reduce((s, e) => s + Number(e.total_amount),  0);
  const expInputVat   = (expenses ?? []).filter((e) => e.is_vat_claimable).reduce((s, e) => s + Number(e.vat_amount), 0);

  const whtPnd3Total  = (whtRecords ?? []).filter((w) => w.pnd_type === "pnd3" ).reduce((s, w) => s + Number(w.wht_amount), 0);
  const whtPnd53Total = (whtRecords ?? []).filter((w) => w.pnd_type === "pnd53").reduce((s, w) => s + Number(w.wht_amount), 0);

  const monthLabel = new Date(year, monthNum - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Shared input styles
  const inputCls = "border border-gray-200 rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#1a56db]";
  const labelCls = "text-xs font-semibold text-gray-500 block mb-1";

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tax & VAT</h1>
          <p className="text-sm text-gray-400 mt-0.5">{company.name} · Tax ID {company.tax_id}</p>
        </div>
        <form method="GET" className="flex gap-2 items-center">
          <input type="hidden" name="tab" value={tab} />
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
          />
          <button type="submit" className="bg-[#1a56db] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
            Go
          </button>
        </form>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 bg-white rounded-2xl shadow p-1 overflow-x-auto">
        {(
          [
            { id: "vat",      label: "PP.30 / VAT" },
            { id: "expenses", label: "Expenses / Input VAT" },
            { id: "wht",      label: "WHT · PND 3 & 53" },
            { id: "export",   label: "Export" },
          ] as { id: Tab; label: string }[]
        ).map((t) => (
          <Link
            key={t.id}
            href={`?tab=${t.id}&month=${month}`}
            className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t.id ? "bg-[#1a56db] text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: VAT / PP.30
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "vat" && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{monthLabel} · Output VAT (Sales)</p>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl shadow p-5">
              <p className="text-xl font-bold text-[#1a56db]">฿{fmt(outputBase)}</p>
              <p className="text-sm text-gray-500 mt-1">Sales ex-VAT</p>
              <p className="text-xs text-gray-400">{invoiceCnt} invoices</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-5">
              <p className="text-xl font-bold text-orange-600">฿{fmt(outputVat)}</p>
              <p className="text-sm text-gray-500 mt-1">Output VAT 7%</p>
              <p className="text-xs text-gray-400">Collected from customers</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-5">
              <p className="text-xl font-bold text-green-600">฿{fmt(inputVat)}</p>
              <p className="text-sm text-gray-500 mt-1">Input VAT (claimable)</p>
              <p className="text-xs text-gray-400">From expense invoices</p>
            </div>
            <div className={`rounded-2xl p-5 text-white ${netVat >= 0 ? "bg-red-600" : "bg-green-700"}`}>
              <p className="text-xl font-bold">฿{fmt(Math.abs(netVat))}</p>
              <p className="text-sm opacity-90 mt-1">{netVat >= 0 ? "VAT Payable (PP.30)" : "VAT Refund"}</p>
              <p className="text-xs opacity-70">Output − Input</p>
            </div>
          </div>

          {/* Sales invoice table */}
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">
                Tax Invoices — Sales
                <span className="ml-2 text-sm font-normal text-gray-400">({taxInvoices?.length ?? 0})</span>
              </h2>
              <span className="text-xs text-gray-400">Auto-created from POS + PromptPay</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Invoice No.</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Ex-VAT</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">VAT 7%</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(taxInvoices ?? []).map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{inv.invoice_number}</td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{inv.issue_date}</td>
                      <td className="px-4 py-2.5 text-gray-700 max-w-[200px]">
                        <span className="line-clamp-1">{inv.customer_name}</span>
                        {inv.customer_tax_id && (
                          <span className="text-xs text-gray-400 block font-mono">{inv.customer_tax_id}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">฿{fmt(Number(inv.before_vat_amount))}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-orange-600">฿{fmt(Number(inv.vat_amount))}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900">฿{fmt(Number(inv.total_amount))}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          inv.payment_method === "cash"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {inv.payment_method === "cash" ? "Cash" : inv.payment_method ?? "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!taxInvoices || taxInvoices.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                        No sales invoices for {monthLabel}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: EXPENSES / INPUT VAT
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "expenses" && (
        <div>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl shadow p-5">
              <p className="text-xl font-bold text-gray-900">{expenses?.length ?? 0}</p>
              <p className="text-sm text-gray-500 mt-1">Expenses recorded</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-5">
              <p className="text-xl font-bold text-red-600">฿{fmt(expTotalAmt)}</p>
              <p className="text-sm text-gray-500 mt-1">Total spent (inc. VAT)</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-5">
              <p className="text-xl font-bold text-green-600">฿{fmt(expInputVat)}</p>
              <p className="text-sm text-gray-500 mt-1">Input VAT claimable</p>
            </div>
          </div>

          {/* Add Expense Form — admin/owner only */}
          {canEdit && <div className="bg-white rounded-2xl shadow p-6 mb-6">
            <h2 className="font-bold text-gray-900 mb-5">Add Expense Invoice</h2>
            <form action={addExpenseAction}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelCls}>Supplier Name *</label>
                  <input name="supplier_name" required className={inputCls} placeholder="e.g. True Internet Co." />
                </div>
                <div>
                  <label className={labelCls}>Supplier Tax ID</label>
                  <input name="supplier_tax_id" className={inputCls} placeholder="13 digits" maxLength={13} />
                </div>
                <div>
                  <label className={labelCls}>Their Invoice No.</label>
                  <input name="supplier_invoice_no" className={inputCls} placeholder="As shown on their invoice" />
                </div>

                <div>
                  <label className={labelCls}>Invoice Date *</label>
                  <input
                    name="issue_date"
                    type="date"
                    required
                    defaultValue={`${month}-01`}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Category *</label>
                  <select name="category" required className={inputCls}>
                    {Object.entries(CATEGORIES).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Amount ex-VAT (฿) *</label>
                  <input
                    name="before_vat_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className={inputCls}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className={labelCls}>VAT Rate</label>
                  <select name="vat_rate" className={inputCls}>
                    <option value="7">7% (Standard)</option>
                    <option value="0">0% (Zero-rated / Exempt)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Input VAT Claimable?</label>
                  <select name="is_vat_claimable" className={inputCls}>
                    <option value="true">Yes — I have a tax invoice</option>
                    <option value="false">No — no tax invoice</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>WHT Deducted?</label>
                  <select name="wht_deducted" className={inputCls}>
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls}>WHT Amount (฿)</label>
                  <input
                    name="wht_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputCls}
                    placeholder="Only if WHT was deducted"
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Description / Notes</label>
                  <input name="description" className={inputCls} placeholder="Optional note" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                VAT Amount and Total are auto-calculated from Amount ex-VAT × VAT Rate.
              </p>
              <button
                type="submit"
                className="bg-[#1a56db] text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                + Add Expense
              </button>
            </form>
          </div>}

          {/* Expense table */}
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">
                Expenses — {monthLabel}
                <span className="ml-2 text-sm font-normal text-gray-400">({expenses?.length ?? 0})</span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Supplier</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Ex-VAT</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">VAT</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Claimable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(expenses ?? []).map((exp: any) => (
                    <tr key={exp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{exp.issue_date}</td>
                      <td className="px-4 py-2.5 text-gray-700">
                        <span className="font-medium">{exp.supplier_name}</span>
                        {exp.supplier_invoice_no && (
                          <span className="text-xs text-gray-400 block">#{exp.supplier_invoice_no}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">
                          {CATEGORIES[exp.category] ?? exp.category}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">฿{fmt(Number(exp.before_vat_amount))}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-orange-600">฿{fmt(Number(exp.vat_amount))}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900">฿{fmt(Number(exp.total_amount))}</td>
                      <td className="px-4 py-2.5 text-center">
                        {exp.is_vat_claimable
                          ? <span className="text-green-600 text-xs font-bold">✓</span>
                          : <span className="text-gray-300 text-xs">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                  {(!expenses || expenses.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                        No expenses for {monthLabel}. Add one above.
                      </td>
                    </tr>
                  )}
                </tbody>
                {(expenses ?? []).length > 0 && (
                  <tfoot className="border-t border-gray-200 bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-600">Totals</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-700">
                        ฿{fmt((expenses ?? []).reduce((s, e) => s + Number(e.before_vat_amount), 0))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-orange-600">฿{fmt(expInputVat)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">฿{fmt(expTotalAmt)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: WHT — PND 3 & 53
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "wht" && (
        <div>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl shadow p-5">
              <p className="text-xl font-bold text-[#1a56db]">฿{fmt(whtPnd3Total)}</p>
              <p className="text-sm text-gray-500 mt-1">PND 3 — Individuals</p>
              <p className="text-xs text-gray-400">{(whtRecords ?? []).filter((w) => w.pnd_type === "pnd3").length} records</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-5">
              <p className="text-xl font-bold text-purple-600">฿{fmt(whtPnd53Total)}</p>
              <p className="text-sm text-gray-500 mt-1">PND 53 — Companies</p>
              <p className="text-xs text-gray-400">{(whtRecords ?? []).filter((w) => w.pnd_type === "pnd53").length} records</p>
            </div>
            <div className="bg-gray-800 text-white rounded-2xl shadow p-5">
              <p className="text-xl font-bold">฿{fmt(whtPnd3Total + whtPnd53Total)}</p>
              <p className="text-sm opacity-70 mt-1">Total WHT to remit</p>
              <p className="text-xs opacity-50">Due by 7th of next month</p>
            </div>
          </div>

          {/* Add WHT Form — admin/owner only */}
          {canEdit && <div className="bg-white rounded-2xl shadow p-6 mb-6">
            <h2 className="font-bold text-gray-900 mb-5">Add WHT Record</h2>
            <form action={addWhtAction}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
                <div>
                  <label className={labelCls}>Form Type *</label>
                  <select name="pnd_type" required className={inputCls}>
                    <option value="pnd3">PND 3 — Individual</option>
                    <option value="pnd53">PND 53 — Company / Juristic</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Payee Name *</label>
                  <input
                    name="payee_name"
                    required
                    className={inputCls}
                    placeholder="Name as on ID / company registration"
                  />
                </div>
                <div>
                  <label className={labelCls}>Payee Tax ID * (13 digits)</label>
                  <input
                    name="payee_tax_id"
                    required
                    className={inputCls}
                    placeholder="0000000000000"
                    maxLength={13}
                  />
                </div>

                <div>
                  <label className={labelCls}>Income Type (Section 40) *</label>
                  <select name="income_type_code" required className={inputCls}>
                    {Object.entries(INCOME_TYPES).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Payment Date *</label>
                  <input
                    name="payment_date"
                    type="date"
                    required
                    defaultValue={`${month}-01`}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Gross Payment Amount (฿) *</label>
                  <input
                    name="payment_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className={inputCls}
                    placeholder="Amount before WHT deduction"
                  />
                </div>

                <div>
                  <label className={labelCls}>WHT Rate (%) *</label>
                  <select name="wht_rate" required className={inputCls} defaultValue="3">
                    <option value="0.75">0.75%</option>
                    <option value="1">1%</option>
                    <option value="1.5">1.5%</option>
                    <option value="2">2%</option>
                    <option value="3">3% (most services)</option>
                    <option value="5">5% (rental)</option>
                    <option value="10">10%</option>
                    <option value="15">15%</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Certificate No.</label>
                  <input
                    name="certificate_number"
                    className={inputCls}
                    placeholder="ใบรับรองการหักภาษี ณ ที่จ่าย"
                  />
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <input name="notes" className={inputCls} placeholder="Optional description" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                WHT Amount = Gross × Rate%. Net Paid = Gross − WHT. Both are calculated automatically.
              </p>
              <button
                type="submit"
                className="bg-[#1a56db] text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                + Add WHT Record
              </button>
            </form>
          </div>}

          {/* WHT table */}
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">
                WHT Records — {monthLabel}
                <span className="ml-2 text-sm font-normal text-gray-400">({whtRecords?.length ?? 0})</span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Form</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Payee</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Gross</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Rate</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">WHT</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Net Paid</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Filed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(whtRecords ?? []).map((w: any) => (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          w.pnd_type === "pnd3"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}>
                          {w.pnd_type === "pnd3" ? "PND 3" : "PND 53"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{w.payment_date}</td>
                      <td className="px-4 py-2.5 text-gray-700">
                        <span className="font-medium">{w.payee_name}</span>
                        <span className="text-xs text-gray-400 font-mono block">{w.payee_tax_id}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[140px]">
                        {INCOME_TYPES[w.income_type_code] ?? w.income_type_code}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">฿{fmt(Number(w.payment_amount))}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{w.wht_rate}%</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-red-600">฿{fmt(Number(w.wht_amount))}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">฿{fmt(Number(w.net_payment))}</td>
                      <td className="px-4 py-2.5 text-center">
                        {w.filed
                          ? <span className="text-green-600 text-xs font-bold">✓ Filed</span>
                          : <span className="text-gray-400 text-xs">Pending</span>
                        }
                      </td>
                    </tr>
                  ))}
                  {(!whtRecords || whtRecords.length === 0) && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                        No WHT records for {monthLabel}. Add one above.
                      </td>
                    </tr>
                  )}
                </tbody>
                {(whtRecords ?? []).length > 0 && (
                  <tfoot className="border-t border-gray-200 bg-gray-50">
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-gray-600">Totals</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-red-600">
                        ฿{fmt((whtRecords ?? []).reduce((s, w) => s + Number(w.wht_amount), 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: EXPORT
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "export" && (
        <div className="space-y-6">
          <p className="text-sm text-gray-500">
            Downloads for <strong>{monthLabel}</strong>.
            PP.30 CSV is for your records / tax. PND .txt files import directly into RD Prep software.
          </p>

          {/* PP.30 */}
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="font-bold text-gray-900">PP.30 — Monthly VAT Return</h2>
                <p className="text-sm text-gray-500 mt-1">ภ.พ.30 · Output VAT minus Input VAT = Net payable to Revenue Department</p>
              </div>
              <a
                href={`/api/tax/pp30?year=${year}&month=${monthNum}`}
                className="bg-[#1a56db] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                Download CSV
              </a>
            </div>
            {vatReport && vatReport.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Section</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Description</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-gray-600">Count</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-gray-600">Base Amount</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-gray-600">VAT Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {vatReport.map((row: any) => (
                      <tr
                        key={row.line_no}
                        className={row.section === "NET" ? "bg-yellow-50 font-semibold" : ""}
                      >
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            row.section === "OUTPUT"
                              ? "bg-blue-100 text-blue-700"
                              : row.section === "INPUT"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}>
                            {row.section}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{row.description}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500">{row.invoice_count ?? "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {row.base_amount != null ? `฿${fmt(Number(row.base_amount))}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                          {row.vat_amount != null ? `฿${fmt(Number(row.vat_amount))}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* PND 3 */}
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-gray-900">PND 3 — Individual WHT Return</h2>
                <p className="text-sm text-gray-500 mt-1 max-w-md">
                  ภ.ง.ด.3 · Tab-delimited .txt file. Open RD Prep → Import .txt → verify → generate .rdx → submit at e-filing.rd.go.th
                </p>
              </div>
              <a
                href={`/api/tax/pnd?type=pnd3&year=${year}&month=${monthNum}`}
                className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors whitespace-nowrap"
              >
                Download .txt
              </a>
            </div>
          </div>

          {/* PND 53 */}
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-gray-900">PND 53 — Juristic WHT Return</h2>
                <p className="text-sm text-gray-500 mt-1 max-w-md">
                  ภ.ง.ด.53 · Same process as PND 3 but for companies and juristic persons.
                </p>
              </div>
              <a
                href={`/api/tax/pnd?type=pnd53&year=${year}&month=${monthNum}`}
                className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors whitespace-nowrap"
              >
                Download .txt
              </a>
            </div>
          </div>

          {/* CIT note */}
          <div className="bg-blue-50 rounded-2xl px-6 py-5 border border-blue-100">
            <h3 className="font-bold text-blue-800 mb-1">CIT 51 & CIT 50 — Corporate Income Tax</h3>
            <p className="text-sm text-blue-700">
              The database is ready to generate CIT summaries. Once you have entered expenses for the full period,
              go to <strong>Export</strong> and the CIT data will appear automatically using the <code>get_cit_summary()</code> function.
              These are typically filed semi-annually (CIT 51, August) and annually (CIT 50, May).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

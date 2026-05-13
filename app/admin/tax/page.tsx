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
  // Auto-generate certificate number if left blank
  const rawCertNumber = (formData.get("certificate_number") as string) || null;
  const notes         = (formData.get("notes") as string) || null;

  const whtAmount  = Math.round(paymentAmount * whtRate / 100 * 100) / 100;
  const netPayment = Math.round((paymentAmount - whtAmount) * 100) / 100;

  const [year, month] = paymentDate.split("-").map(Number);

  // Auto-generate certificate number if not supplied
  let certNumber = rawCertNumber;
  if (!certNumber) {
    const { data: autoNum } = await admin.rpc("next_wht_cert_number", {
      p_company_id: company.id,
      p_year:       year,
      p_month:      month,
    });
    certNumber = (autoNum as string | null) ?? null;
  }
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
  let taxPeriod:   any           = null;
  let citRows:     any[]  | null = null;

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

  if (tab === "export") {
    // Filing status for this period
    const { data: pData } = await admin
      .from("tax_periods")
      .select("id, pp30_status, pp30_filed_at, pnd3_status, pnd53_status")
      .eq("company_id", company.id)
      .eq("year", year)
      .eq("month", monthNum)
      .maybeSingle();
    taxPeriod = pData;

    // CIT annual summary for the selected year
    const { data: cData } = await admin.rpc("get_cit_summary", {
      p_company_id: company.id,
      p_year:       year,
      p_half:       "annual",
    });
    citRows = (cData ?? []) as any[];
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
                Tax Invoices, Sales
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
                          {inv.payment_method === "cash" ? "Cash" : inv.payment_method ?? "-"}
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
          {/* Two-system notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 flex gap-3">
            <span className="text-amber-500 text-lg shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">These are tax-grade expense invoices only</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Quick operational expenses logged on the{" "}
                <a href="/admin/reports/cash" className="underline font-semibold">Cash Report</a>{" "}
                are separate and not included here. For any supplier invoice you want to claim input VAT on,
                enter it using the form below (supplier name + tax ID required).
              </p>
            </div>
          </div>

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

          {/* Add Expense Form, admin/owner only */}
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
                    <option value="true">Yes, I have a tax invoice</option>
                    <option value="false">No, no tax invoice</option>
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
                Expenses, {monthLabel}
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
                          : <span className="text-gray-300 text-xs">-</span>
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
          TAB: WHT, PND 3 & 53
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "wht" && (
        <div>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl shadow p-5">
              <p className="text-xl font-bold text-[#1a56db]">฿{fmt(whtPnd3Total)}</p>
              <p className="text-sm text-gray-500 mt-1">PND 3, Individuals</p>
              <p className="text-xs text-gray-400">{(whtRecords ?? []).filter((w) => w.pnd_type === "pnd3").length} records</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-5">
              <p className="text-xl font-bold text-purple-600">฿{fmt(whtPnd53Total)}</p>
              <p className="text-sm text-gray-500 mt-1">PND 53, Companies</p>
              <p className="text-xs text-gray-400">{(whtRecords ?? []).filter((w) => w.pnd_type === "pnd53").length} records</p>
            </div>
            <div className="bg-gray-800 text-white rounded-2xl shadow p-5">
              <p className="text-xl font-bold">฿{fmt(whtPnd3Total + whtPnd53Total)}</p>
              <p className="text-sm opacity-70 mt-1">Total WHT to remit</p>
              <p className="text-xs opacity-50">Due by 7th of next month</p>
            </div>
          </div>

          {/* Add WHT Form, admin/owner only */}
          {canEdit && <div className="bg-white rounded-2xl shadow p-6 mb-6">
            <h2 className="font-bold text-gray-900 mb-5">Add WHT Record</h2>
            <form action={addWhtAction}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
                <div>
                  <label className={labelCls}>Form Type *</label>
                  <select name="pnd_type" required className={inputCls}>
                    <option value="pnd3">PND 3, Individual</option>
                    <option value="pnd53">PND 53, Company / Juristic</option>
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
                WHT Records, {monthLabel}
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
          <div className="flex items-start justify-between flex-wrap gap-3">
            <p className="text-sm text-gray-500">
              Downloads for <strong>{monthLabel}</strong>.
              PP.30 CSV is for your records. PND .txt files import into RD Prep. Downloading marks the period filed.
            </p>
            {/* Period filing status badges */}
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  { label: "PP.30", status: taxPeriod?.pp30_status, filed_at: taxPeriod?.pp30_filed_at },
                  { label: "PND 3", status: taxPeriod?.pnd3_status, filed_at: null },
                  { label: "PND 53", status: taxPeriod?.pnd53_status, filed_at: null },
                ] as { label: string; status: string | null | undefined; filed_at: string | null | undefined }[]
              ).map(({ label, status, filed_at }) => (
                <div key={label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                  status === "filed"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}>
                  {status === "filed" ? "✓" : "○"} {label}
                  {status === "filed" && filed_at && (
                    <span className="font-normal opacity-70 ml-1">
                      {new Date(filed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* March 2026 form notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-5 py-4 flex gap-3">
            <span className="text-yellow-500 text-lg shrink-0">⚠️</span>
            <p className="text-sm text-yellow-800">
              <strong>March 2026 form update:</strong> The Revenue Department updated the PP.30 (ภ.พ.30) form in
              March 2026. This export covers standard 7% domestic VAT and claimable input VAT. If you have
              zero-rated exports, exempt sales, or receive services from foreign digital operators (ม.82/13),
              verify those sections against the current RD form before your first submission.
            </p>
          </div>

          {/* PP.30 */}
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="font-bold text-gray-900">PP.30, Monthly VAT Return</h2>
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
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500">{row.invoice_count ?? "-"}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {row.base_amount != null ? `฿${fmt(Number(row.base_amount))}` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                          {row.vat_amount != null ? `฿${fmt(Number(row.vat_amount))}` : "-"}
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
                <h2 className="font-bold text-gray-900">PND 3, Individual WHT Return</h2>
                <p className="text-sm text-gray-500 mt-1 max-w-md">
                  ภ.ง.ด.3 · Tab-delimited .txt file. Open RD Prep &rarr; Import .txt &rarr; verify &rarr; generate .rdx &rarr; submit at e-filing.rd.go.th
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
                <h2 className="font-bold text-gray-900">PND 53, Juristic WHT Return</h2>
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

          {/* CIT 51 / CIT 50, Corporate Income Tax */}
          <div className="bg-white rounded-2xl shadow p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="font-bold text-gray-900">CIT, Corporate Income Tax</h2>
                <p className="text-sm text-gray-500 mt-1">
                  CIT 51 (semi-annual prepayment, due 31 Aug) &nbsp;|&nbsp; CIT 50 (annual return, due within 150 days of FY end)
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Showing full-year {year} estimate. Use H1/H2 links below for semi-annual figures.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <a
                  href={`/api/tax/cit?year=${year}&half=annual&format=csv`}
                  className="bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors whitespace-nowrap text-center"
                >
                  Annual CSV
                </a>
                <div className="flex gap-2">
                  <a
                    href={`/api/tax/cit?year=${year}&half=h1&format=csv`}
                    className="flex-1 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors text-center"
                  >
                    H1 CSV
                  </a>
                  <a
                    href={`/api/tax/cit?year=${year}&half=h2&format=csv`}
                    className="flex-1 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors text-center"
                  >
                    H2 CSV
                  </a>
                </div>
              </div>
            </div>

            {citRows && citRows.length > 0 && (
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Item</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-gray-600">Amount (THB)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {citRows.map((row: any, i: number) => (
                      <tr
                        key={i}
                        className={
                          row.label === "Estimated Net Profit"
                            ? "bg-blue-50 font-semibold"
                            : row.label === "Estimated CIT (20%)"
                            ? "bg-red-50 font-bold"
                            : ""
                        }
                      >
                        <td className="px-4 py-3 text-gray-700">{row.label}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                          ฿{fmt(Number(row.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-gray-400 mt-4">
              CIT estimate uses the standard 20% rate. SME rate is 15% on net profit up to ฿3,000,000 and
              20% above that. Verify with your accountant before filing. These figures do not account for
              depreciation schedules, deductible allowances, or prior-year loss carry-forwards.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

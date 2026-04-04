import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { bangkokToday } from "@/lib/timezone";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager", "owner"].includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const today = bangkokToday();
  const from  = searchParams.get("from") ?? `${today}T00:00:00+07:00`;
  const to    = searchParams.get("to")   ?? `${today}T23:59:59+07:00`;

  const fromDate = from.split("T")[0];
  const toDate   = to.split("T")[0];

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  // ── 1. ALL POS cash_sales (single source of truth for cash) ───────────
  const { data: cashSales } = await admin
    .from("cash_sales")
    .select("id, processed_at, sale_type, amount, notes, staff_name, reference_id")
    .gte("processed_at", from)
    .lte("processed_at", to)
    .order("processed_at", { ascending: true });

  // ── 2. Approved non-cash member registrations (PromptPay only) ─────────
  const { data: memberPayments } = await admin
    .from("member_registrations")
    .select("id, name, membership_type, amount_paid, payment_method, slip_reviewed_at, slip_image")
    .eq("slip_status", "approved")
    .neq("payment_method", "cash")
    .gte("slip_reviewed_at", from)
    .lte("slip_reviewed_at", to)
    .order("slip_reviewed_at", { ascending: true });

  // ── 3. Expenses for the period ─────────────────────────────────────────
  const { data: expenses } = await admin
    .from("expenses")
    .select("id, expense_date, category, description, amount, receipt_url, added_by_name")
    .eq("voided", false)
    .gte("expense_date", fromDate)
    .lte("expense_date", toDate)
    .order("expense_date", { ascending: true });

  // ── Build income rows ──────────────────────────────────────────────────
  type IncomeRow = {
    id: string | number;
    date: string;
    time: string;
    type: string;
    description: string;
    method: string;
    amount: number;
    staff: string;
    notes: string;
    slip_url: string;
  };

  const slipUrl = (path: string | null) =>
    path ? `${SUPABASE_URL}/storage/v1/object/public/slips/${path}` : "";

  const posRows: IncomeRow[] = (cashSales ?? []).map((s) => {
    const dt = new Date(s.processed_at as string);
    return {
      id: s.id as number,
      date: dt.toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok" }),
      time: dt.toLocaleTimeString("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", minute: "2-digit", hour12: true }),
      type: (s.sale_type as string) ?? "POS",
      description: (s.notes as string) ?? (s.sale_type === "membership" ? `POS Membership${s.staff_name ? ` · ${s.staff_name}` : ""}` : "POS Sale"),
      method: "cash",
      amount: Number(s.amount),
      staff: (s.staff_name as string) ?? "",
      notes: (s.notes as string) ?? "",
      slip_url: "",
    };
  });

  const memberRows: IncomeRow[] = (memberPayments ?? []).map((m) => {
    const dt = m.slip_reviewed_at ? new Date(m.slip_reviewed_at as string) : null;
    return {
      id: `R${m.id}`,
      date: dt ? dt.toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok" }) : "",
      time: dt ? dt.toLocaleTimeString("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", minute: "2-digit", hour12: true }) : "",
      type: "Registration",
      description: `${m.name}: ${m.membership_type}`,
      method: (m.payment_method as string) ?? "promptpay",
      amount: Number(m.amount_paid ?? 0),
      staff: "",
      notes: "",
      slip_url: slipUrl(m.slip_image as string | null),
    };
  });

  const allIncomeRows = [...posRows, ...memberRows].sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
  );

  // ── Totals ─────────────────────────────────────────────────────────────
  const cashTotal     = allIncomeRows.filter((r) => r.method === "cash").reduce((s, r) => s + r.amount, 0);
  const transferTotal = allIncomeRows.filter((r) => r.method !== "cash").reduce((s, r) => s + r.amount, 0);
  const grandTotal    = cashTotal + transferTotal;
  const expenseTotal  = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const netTotal      = grandTotal - expenseTotal;

  // ── Build CSV ──────────────────────────────────────────────────────────
  const escape = (v: string | number | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;

  const incomeHeader = ["ID", "Date", "Time", "Type", "Description", "Method", "Amount (THB)", "Staff", "Notes", "Slip URL"];
  const incomeDataRows = allIncomeRows.map((r) => [
    r.id, r.date, r.time, r.type, r.description, r.method, r.amount, r.staff, r.notes, r.slip_url,
  ]);

  const expenseHeader = ["ID", "Date", "Category", "Description", "Amount (THB)", "Added By", "Receipt URL"];
  const expenseDataRows = (expenses ?? []).map((e) => [
    e.id,
    e.expense_date,
    e.category,
    e.description ?? "",
    Number(e.amount),
    e.added_by_name ?? "",
    e.receipt_url ? `${SUPABASE_URL}/storage/v1/object/public/${e.receipt_url}` : "",
  ]);

  const lines: string[] = [
    // ── Income ──
    `"=== INCOME ==="`,
    incomeHeader.map(escape).join(","),
    ...incomeDataRows.map((r) => r.map(escape).join(",")),
    // ── Income summary ──
    "",
    `"","","","","","CASH TOTAL",${cashTotal}`,
    `"","","","","","PROMPTPAY TOTAL",${transferTotal}`,
    `"","","","","","INCOME TOTAL",${grandTotal}`,
    "",
    // ── Expenses ──
    `"=== EXPENSES ==="`,
    expenseHeader.map(escape).join(","),
    ...(expenseDataRows.length > 0
      ? expenseDataRows.map((r) => r.map(escape).join(","))
      : [`"","No expenses recorded","","","","",""`]),
    "",
    `"","","","EXPENSE TOTAL","",${expenseTotal}`,
    "",
    // ── Net ──
    `"=== NET ==="`,
    `"Income","฿${grandTotal.toLocaleString()}"`,
    `"Expenses","-฿${expenseTotal.toLocaleString()}"`,
    `"NET TOTAL","฿${netTotal.toLocaleString()}"`,
    `"Transactions",${allIncomeRows.length}`,
  ];

  const csv = lines.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales-${fromDate}-to-${toDate}.csv"`,
    },
  });
}

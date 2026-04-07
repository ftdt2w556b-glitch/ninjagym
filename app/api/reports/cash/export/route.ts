import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { bangkokToday } from "@/lib/timezone";

const MEMBERSHIP_LABELS: Record<string, string> = {
  session_group:    "Group Session",
  session_1to1:     "1-to-1 Private Guide",
  day_camp:         "Day Camp (10am–2pm)",
  combo_game_train: "Combo Game & Train (2 hrs)",
  all_day:          "All Day (max 8 hrs)",
  climb_unguided:   "Unguided Climb Zone (20 min)",
  monthly_flex:     "Monthly Flex: any day or time",
  birthday_event:   "Birthday / Event Guest",
  group_bulk:       "Group Sessions (bulk)",
  daycamp_bulk:     "Day Camp Sessions (bulk)",
  "1to1_bulk":      "1-to-1 Sessions (bulk)",
  allday_bulk:      "All Day Passes (bulk)",
  combo_bulk:       "Combo Sessions (bulk)",
};

const SALE_TYPE_LABEL: Record<string, string> = {
  membership: "Membership",
  walkin:     "Walk-in",
  shop:       "Shop Sale",
};

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
    .select("id, processed_at, sale_type, amount, notes, staff_name, reference_id, items")
    .gte("processed_at", from)
    .lte("processed_at", to)
    .order("processed_at", { ascending: true });

  // ── 2. Approved non-cash member registrations (PromptPay only) ─────────
  const { data: memberPayments } = await admin
    .from("member_registrations")
    .select("id, name, membership_type, amount_paid, payment_method, slip_reviewed_at, slip_image, sessions_purchased")
    .eq("slip_status", "approved")
    .neq("payment_method", "cash")
    .gte("slip_reviewed_at", from)
    .lte("slip_reviewed_at", to)
    .order("slip_reviewed_at", { ascending: true });

  // ── Prices for qty calculation ─────────────────────────────────────────
  const { data: priceRows } = await admin.from("settings").select("key, value").like("key", "price_%");
  const priceMap: Record<string, number> = {};
  for (const row of priceRows ?? []) {
    priceMap[(row.key as string).replace("price_", "")] = Number(row.value);
  }
  const labelToKey = Object.fromEntries(Object.entries(MEMBERSHIP_LABELS).map(([k, v]) => [v, k]));

  function programWithQty(label: string, typeKey: string, amt: number): string {
    const unitPrice = priceMap[typeKey] ?? 0;
    const qty = unitPrice > 0 && amt > 0 ? Math.round(amt / unitPrice) : 1;
    return qty > 1 ? `${label} ×${qty}` : label;
  }

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
    const saleType = (s.sale_type as string) ?? "";
    const rawNotes = (s.notes as string | null) ?? "";
    const walkInMatch = rawNotes.match(/Quick walk-in:\s*(.+)/i);
    const customerName = walkInMatch ? walkInMatch[1] : (rawNotes || "");

    // Extract program from items array
    const items = s.items as Array<{ name?: string; label?: string }> | null;
    const rawItemName = items?.[0]?.name || items?.[0]?.label || "";
    let programLabel = "";
    if (rawItemName) {
      const programPart = rawItemName.includes(": ")
        ? rawItemName.split(": ").slice(1).join(": ")
        : rawItemName;
      const typeKey = MEMBERSHIP_LABELS[programPart] ? programPart : (labelToKey[programPart] ?? programPart);
      const display = MEMBERSHIP_LABELS[typeKey] ?? programPart;
      programLabel = programWithQty(display, typeKey, Number(s.amount));
    } else if (saleType && saleType !== "shop") {
      const display = (MEMBERSHIP_LABELS[saleType] ?? saleType) || "";
      programLabel = display ? programWithQty(display, saleType, Number(s.amount)) : "";
    }

    const description = customerName && programLabel
      ? `${customerName} — ${programLabel}`
      : customerName || programLabel || "POS Sale";

    return {
      id: s.id as number,
      date: dt.toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok" }),
      time: dt.toLocaleTimeString("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", minute: "2-digit", hour12: true }),
      type: SALE_TYPE_LABEL[saleType] ?? saleType ?? "POS Sale",
      description,
      method: "Cash",
      amount: Number(s.amount),
      staff: (s.staff_name as string) ?? "",
      notes: "",
      slip_url: "",
    };
  });

  const memberRows: IncomeRow[] = (memberPayments ?? []).map((m) => {
    const dt = m.slip_reviewed_at ? new Date(m.slip_reviewed_at as string) : null;
    const membershipType = m.membership_type as string;
    const baseLabel = MEMBERSHIP_LABELS[membershipType] ?? membershipType ?? "";
    const amt = Number(m.amount_paid ?? 0);
    const sessionsPurchased = Number(m.sessions_purchased ?? 0);
    const programLabel = sessionsPurchased > 1
      ? `${baseLabel} ×${sessionsPurchased}`
      : programWithQty(baseLabel, membershipType, amt);
    return {
      id: `R${m.id}`,
      date: dt ? dt.toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok" }) : "",
      time: dt ? dt.toLocaleTimeString("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", minute: "2-digit", hour12: true }) : "",
      type: "Registration",
      description: `${m.name} — ${programLabel}`,
      method: "PromptPay / Transfer",
      amount: amt,
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

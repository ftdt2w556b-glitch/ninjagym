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

  // The Revenue page passes full ISO timestamps with +07:00 offset
  // Fall back to today (Bangkok) if not provided
  const today = bangkokToday();
  const from  = searchParams.get("from") ?? `${today}T00:00:00+07:00`;
  const to    = searchParams.get("to")   ?? `${today}T23:59:59+07:00`;

  // Extract date portion for the filename
  const fromDate = from.split("T")[0];
  const toDate   = to.split("T")[0];

  // ── 1. POS cash_sales — exclude membership type (counted via member_registrations) ──
  const { data: cashSales } = await admin
    .from("cash_sales")
    .select("id, processed_at, sale_type, amount, payment_method, notes, profiles(name, email)")
    .neq("sale_type", "membership")
    .gte("processed_at", from)
    .lte("processed_at", to)
    .order("processed_at", { ascending: true });

  // ── 2. Approved member registrations ─────────────────────────
  const { data: memberPayments } = await admin
    .from("member_registrations")
    .select("id, name, membership_type, amount_paid, payment_method, slip_reviewed_at")
    .eq("slip_status", "approved")
    .gte("slip_reviewed_at", from)
    .lte("slip_reviewed_at", to)
    .order("slip_reviewed_at", { ascending: true });

  // ── Build unified rows ────────────────────────────────────────
  type Row = {
    id: string | number;
    date: string;
    time: string;
    type: string;
    description: string;
    method: string;
    amount: number;
    source: string;
    staff: string;
    notes: string;
  };

  const posRows: Row[] = (cashSales ?? []).map((s) => {
    const dt = new Date(s.processed_at);
    const prof = s.profiles as { name?: string; email?: string } | null;
    return {
      id: s.id,
      date: dt.toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok" }),
      time: dt.toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }),
      type: s.sale_type ?? "POS",
      description: s.notes ?? "",
      method: s.payment_method ?? "cash",
      amount: Number(s.amount),
      source: "POS",
      staff: prof?.name ?? prof?.email ?? "",
      notes: s.notes ?? "",
    };
  });

  const memberRows: Row[] = (memberPayments ?? []).map((m) => {
    const dt = m.slip_reviewed_at ? new Date(m.slip_reviewed_at) : null;
    return {
      id: `R${m.id}`,
      date: dt ? dt.toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok" }) : "",
      time: dt ? dt.toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }) : "",
      type: "Registration",
      description: `${m.name}: ${m.membership_type}`,
      method: m.payment_method ?? "cash",
      amount: Number(m.amount_paid ?? 0),
      source: "Registration",
      staff: "",
      notes: "",
    };
  });

  // Merge and sort chronologically
  const allRows = [...posRows, ...memberRows].sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
  );

  // ── Summary rows ─────────────────────────────────────────────
  const cashTotal      = allRows.filter((r) => r.method === "cash").reduce((s, r) => s + r.amount, 0);
  const transferTotal  = allRows.filter((r) => r.method !== "cash").reduce((s, r) => s + r.amount, 0);
  const grandTotal     = cashTotal + transferTotal;

  // ── Build CSV ────────────────────────────────────────────────
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

  const header = ["ID", "Date", "Time", "Type", "Description", "Method", "Amount (THB)", "Source", "Staff", "Notes"];

  const dataRows = allRows.map((r) => [
    r.id, r.date, r.time, r.type, r.description,
    r.method, r.amount, r.source, r.staff, r.notes,
  ]);

  const summaryRows = [
    [],
    ["", "", "", "", "", "CASH TOTAL", cashTotal, "", "", ""],
    ["", "", "", "", "", "TRANSFER / PROMPTPAY TOTAL", transferTotal, "", "", ""],
    ["", "", "", "", "", "GRAND TOTAL", grandTotal, "", "", ""],
    ["", "", "", "", "", "TOTAL TRANSACTIONS", allRows.length, "", "", ""],
  ];

  const csv = [
    header.map(escape).join(","),
    ...dataRows.map((r) => r.map(escape).join(",")),
    ...summaryRows.map((r) => r.map(escape).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="revenue-${fromDate}-to-${toDate}.csv"`,
    },
  });
}

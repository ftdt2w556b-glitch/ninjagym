import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { bangkokToday } from "@/lib/timezone";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager", "owner"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const today = bangkokToday();
  const from = searchParams.get("from") ?? `${today}T00:00:00+07:00`;
  const to   = searchParams.get("to")   ?? `${today}T23:59:59+07:00`;

  const fromDate = from.split("T")[0];
  const toDate   = to.split("T")[0];

  const { data: sales } = await admin
    .from("cash_sales")
    .select("id, processed_at, amount, change_given, sale_type, staff_name, notes, items")
    .gte("processed_at", from)
    .lte("processed_at", to)
    .order("processed_at", { ascending: true });

  const rows = (sales ?? []).map((s) => {
    const dt = new Date(s.processed_at as string);
    const items = Array.isArray(s.items) ? (s.items as { type?: string }[]) : null;
    const typeLabel = items
      ? [...new Set(items.map((i) => i.type).filter(Boolean))].join(", ")
      : (s.sale_type ?? "POS Sale");
    const desc = (s.notes as string | null) ?? typeLabel;
    return {
      id:      s.id,
      date:    dt.toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok" }),
      time:    dt.toLocaleTimeString("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", minute: "2-digit", hour12: true }),
      staff:   (s.staff_name as string | null) ?? "",
      type:    typeLabel,
      desc,
      amount:  Number(s.amount),
      change:  s.change_given != null ? Number(s.change_given) : "",
    };
  });

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

  const header = ["ID", "Date", "Time", "Staff", "Type", "Description", "Amount (THB)", "Change Given"];
  const dataRows = rows.map((r) => [r.id, r.date, r.time, r.staff, r.type, r.desc, r.amount, r.change]);
  const summary = [
    [],
    ["", "", "", "", "", "TOTAL CASH", total, ""],
    ["", "", "", "", "", "TOTAL TRANSACTIONS", rows.length, ""],
  ];

  const csv = [
    header.map(escape).join(","),
    ...dataRows.map((r) => r.map(escape).join(",")),
    ...summary.map((r) => r.map(escape).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pos-sales-${fromDate}-to-${toDate}.csv"`,
    },
  });
}

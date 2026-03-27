import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? new Date().toISOString().split("T")[0];
  const to = searchParams.get("to") ?? from;

  const admin = createAdminClient();
  const { data: sales } = await admin
    .from("cash_sales")
    .select("*, profiles(name, email)")
    .gte("processed_at", `${from}T00:00:00`)
    .lte("processed_at", `${to}T23:59:59`)
    .order("processed_at", { ascending: true });

  const rows = [
    ["ID", "Date", "Time", "Type", "Amount (THB)", "Staff", "Drawer Opened", "Receipt Printed", "Notes"],
    ...(sales ?? []).map((s) => [
      s.id,
      new Date(s.processed_at).toLocaleDateString(),
      new Date(s.processed_at).toLocaleTimeString(),
      s.sale_type ?? "",
      s.amount,
      (s.profiles as { name?: string; email?: string } | null)?.name ??
      (s.profiles as { name?: string; email?: string } | null)?.email ?? "",
      s.drawer_opened ? "Yes" : "No",
      s.receipt_printed ? "Yes" : "No",
      s.notes ?? "",
    ]),
  ];

  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="cash-report-${from}-${to}.csv"`,
    },
  });
}

import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/tax/pp30?year=2026&month=4
// Returns a CSV summary of the PP.30 monthly VAT report.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year  = parseInt(searchParams.get("year")  ?? "0", 10);
  const month = parseInt(searchParams.get("month") ?? "0", 10);

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "year and month (1–12) are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: company } = await admin
    .from("companies")
    .select("id, name, tax_id, address")
    .limit(1)
    .single();

  if (!company) {
    return NextResponse.json({ error: "No company record found" }, { status: 500 });
  }

  const { data, error } = await admin.rpc("get_monthly_vat_report", {
    p_company_id: company.id,
    p_year:       year,
    p_month:      month,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type VatRow = {
    section:       string;
    line_no:       number;
    description:   string;
    invoice_count: number | null;
    base_amount:   number | null;
    vat_amount:    number | null;
  };

  const rows = (data ?? []) as VatRow[];
  const mm   = String(month).padStart(2, "0");

  const csvLines = [
    `# PP.30 Monthly VAT Report`,
    `# Company   : ${company.name}`,
    `# Tax ID    : ${company.tax_id}`,
    `# Period    : ${year}-${mm}`,
    `# Generated : ${new Date().toISOString()}`,
    `#`,
    `Section,Line,Description,Invoice Count,Base Amount (THB),VAT Amount (THB)`,
    ...rows.map((r) =>
      [
        r.section,
        r.line_no,
        `"${r.description}"`,
        r.invoice_count ?? "",
        r.base_amount   ?? "",
        r.vat_amount    ?? "",
      ].join(",")
    ),
  ].join("\n");

  const filename = `PP30-${year}-${mm}.csv`;

  return new NextResponse(csvLines, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

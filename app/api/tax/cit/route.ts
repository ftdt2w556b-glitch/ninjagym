import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/tax/cit?year=2026&half=annual|h1|h2
// Returns CIT summary data (revenue, expenses, net profit, estimated CIT).
// Add &format=csv to download as a CSV file.
//
// p_half values:
//   h1     = Jan-Jun  (CIT 51 semi-annual prepayment, due August)
//   h2     = Jul-Dec
//   annual = Full year (CIT 50 annual return, due May following year)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year   = parseInt(searchParams.get("year") ?? "0", 10);
  const half   = searchParams.get("half") ?? "annual";
  const format = searchParams.get("format") ?? "json";

  if (!year || year < 2020 || year > 2100) {
    return NextResponse.json({ error: "year required (e.g. year=2026)" }, { status: 400 });
  }
  if (!["h1", "h2", "annual"].includes(half)) {
    return NextResponse.json({ error: "half must be h1, h2, or annual" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: company } = await admin
    .from("companies")
    .select("id, name, tax_id")
    .limit(1)
    .single();

  if (!company) {
    return NextResponse.json({ error: "No company record found" }, { status: 500 });
  }

  const { data, error } = await admin.rpc("get_cit_summary", {
    p_company_id: company.id,
    p_year:       year,
    p_half:       half,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as { label: string; amount: number }[];

  if (format === "csv") {
    const periodLabel =
      half === "h1"     ? `H1 ${year} (Jan-Jun, CIT 51)` :
      half === "h2"     ? `H2 ${year} (Jul-Dec)` :
                          `Full Year ${year} (CIT 50)`;

    const csvLines = [
      `# Corporate Income Tax Summary`,
      `# Company   : ${company.name}`,
      `# Tax ID    : ${company.tax_id}`,
      `# Period    : ${periodLabel}`,
      `# Generated : ${new Date().toISOString()}`,
      `#`,
      `# CIT 51 (semi-annual prepayment) is due by 31 August each year.`,
      `# CIT 50 (annual return) is due within 150 days of fiscal year end.`,
      `# SME rate: 15% on net profit up to 3,000,000 THB; 20% above that.`,
      `# Verify with your accountant before filing.`,
      `#`,
      `Label,Amount (THB)`,
      ...rows.map((r) => `"${r.label}",${r.amount}`),
    ].join("\n");

    const filename = `CIT-${year}-${half}.csv`;

    return new NextResponse(csvLines, {
      headers: {
        "Content-Type":        "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({
    rows,
    company: { name: company.name, taxId: company.tax_id },
    year,
    half,
  });
}

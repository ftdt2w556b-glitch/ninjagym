import { createAdminClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/tax/pnd?type=pnd3&year=2026&month=4
// Returns a tab-delimited .txt file for import into Thailand RD Prep software.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pndType = searchParams.get("type") ?? "pnd3"; // "pnd3" or "pnd53"
  const year    = parseInt(searchParams.get("year")  ?? "0", 10);
  const month   = parseInt(searchParams.get("month") ?? "0", 10);

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "year and month (1–12) are required" }, { status: 400 });
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

  const { data, error } = await admin.rpc("generate_pnd_txt", {
    p_pnd_type:   pndType,
    p_company_id: company.id,
    p_year:       year,
    p_month:      month,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const mm       = String(month).padStart(2, "0");
  const filename = `${pndType.toUpperCase()}-${year}-${mm}.txt`;

  return new NextResponse(data as string, {
    headers: {
      "Content-Type":        "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const TAX_ROLES = ["admin", "owner", "tax"];

async function requireTaxAccess() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !TAX_ROLES.includes(profile.role)) return null;
  return user;
}

// GET /api/tax/pnd?type=pnd3&year=2026&month=4
// Returns a tab-delimited .txt file for import into Thailand RD Prep software.
export async function GET(req: NextRequest) {
  if (!(await requireTaxAccess())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Mark the relevant PND status as filed for this period.
  const { data: period } = await admin
    .from("tax_periods")
    .select("id")
    .eq("company_id", company.id)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (period?.id) {
    const statusField = pndType === "pnd3" ? "pnd3_status" : "pnd53_status";
    await admin.from("tax_periods").update({ [statusField]: "filed" }).eq("id", period.id);
  }

  return new NextResponse(data as string, {
    headers: {
      "Content-Type":        "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

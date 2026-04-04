import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

// GET /api/expenses?from=...&to=...
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
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  let query = admin
    .from("expenses")
    .select("*")
    .eq("voided", false)
    .order("expense_date", { ascending: false })
    .order("created_at",   { ascending: false });

  if (from) query = query.gte("expense_date", from.split("T")[0]);
  if (to)   query = query.lte("expense_date", to.split("T")[0]);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/expenses
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role, name").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { expense_date, category, description, amount, receipt_url } = body;

  if (!expense_date || !amount || amount <= 0) {
    return NextResponse.json({ error: "date and amount required" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("expenses")
    .insert({
      expense_date,
      category:     category ?? "other",
      description:  description ?? null,
      amount:       Number(amount),
      receipt_url:  receipt_url ?? null,
      added_by:     user.id,
      added_by_name: (profile as { name?: string } | null)?.name ?? null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

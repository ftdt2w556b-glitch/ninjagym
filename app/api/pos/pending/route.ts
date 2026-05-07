import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

async function isPosUnlocked() {
  const cookieStore = await cookies();
  const posAuth = cookieStore.get("pos_auth")?.value;
  if (!posAuth) return false;
  const admin = createAdminClient();
  const { data } = await admin.from("settings").select("value").eq("key", "pos_password").maybeSingle();
  const expected = data?.value ?? process.env.POS_PASSWORD ?? null;
  return expected ? posAuth === expected : posAuth === "unlocked";
}

export async function GET() {
  if (!(await isPosUnlocked())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("member_registrations")
      .select("id, name, membership_type, amount_paid, kids_names, notes, created_at")
      .eq("slip_status", "cash_pending")
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
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

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/scanner/lookup?id=42
 * Public endpoint — no login required.
 * Returns only the fields the scanner needs to display and check in a member.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("member_registrations")
    .select("id, name, membership_type, slip_status, sessions_remaining, expires_at, kids_names, kids_count")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

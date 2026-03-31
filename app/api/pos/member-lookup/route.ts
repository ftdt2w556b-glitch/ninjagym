import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/pos/member-lookup
 * Find a member by phone number for POS top-up linking.
 * Returns the primary (parent) member record only.
 */
export async function POST(request: NextRequest) {
  const { phone } = await request.json();
  const clean = (phone ?? "").trim().replace(/[\s\-().+]/g, "");

  if (clean.length < 6) {
    return NextResponse.json({ error: "Phone too short" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("member_registrations")
    .select("id, name, phone, sessions_remaining, membership_type")
    .eq("slip_status", "approved")
    .is("parent_member_id", null)
    .order("created_at", { ascending: false });

  const match = (data ?? []).find((r) => {
    if (!r.phone) return false;
    const stored = r.phone.replace(/[\s\-().+]/g, "");
    return stored.endsWith(clean) || clean.endsWith(stored) || stored === clean;
  });

  if (!match) {
    return NextResponse.json({ error: "No member found with that number" }, { status: 404 });
  }

  return NextResponse.json({ id: match.id, name: match.name });
}

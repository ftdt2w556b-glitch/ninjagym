import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/check-phone?phone=xxx
 * Lightweight check: does an approved member exist with this phone?
 * Returns { found: false } or { found: true, id, name }
 */
export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get("phone") ?? "";
  const clean = phone.trim().replace(/[\s\-().+]/g, "");

  if (clean.length < 6) {
    return NextResponse.json({ found: false });
  }

  const admin = createAdminClient();

  const { data: candidates } = await admin
    .from("member_registrations")
    .select("id, name, phone")
    .eq("slip_status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!candidates) return NextResponse.json({ found: false });

  const match = candidates.find((c) => {
    if (!c.phone) return false;
    const stored = c.phone.replace(/[\s\-().+]/g, "");
    return stored.endsWith(clean) || clean.endsWith(stored) || stored === clean;
  });

  if (!match) return NextResponse.json({ found: false });

  return NextResponse.json({ found: true, id: match.id, name: match.name });
}

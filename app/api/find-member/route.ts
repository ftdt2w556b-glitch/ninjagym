import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { signMemberId } from "@/lib/member-token";

/**
 * POST /api/find-member
 * Requires both name AND phone to match — two-factor lookup.
 * Uses admin client so RLS never blocks the query.
 * Only returns approved members.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, phone } = body;
  const pin = body.pin !== undefined ? Number(body.pin) : null;

  const admin = createAdminClient();

  // ── PIN fast-path ────────────────────────────────────────────────
  if (pin !== null && !isNaN(pin)) {
    const { data: pinMember } = await admin
      .from("member_registrations")
      .select("id")
      .eq("pin", pin)
      .is("parent_member_id", null)
      .maybeSingle();
    if (pinMember) return NextResponse.json({ id: pinMember.id, token: signMemberId(pinMember.id) });
    return NextResponse.json(
      { error: "PIN not found. Try searching by name and phone instead." },
      { status: 404 }
    );
  }

  // ── Name + phone lookup ──────────────────────────────────────────
  const cleanName  = (name  ?? "").trim();
  const cleanPhone = (phone ?? "").trim().replace(/[\s\-().+]/g, ""); // strip spaces/dashes/+

  if (!cleanName || !cleanPhone) {
    return NextResponse.json(
      { error: "Please enter both your name and phone number." },
      { status: 400 }
    );
  }

  if (cleanPhone.length < 6) {
    return NextResponse.json(
      { error: "Phone number is too short — please enter your full number." },
      { status: 400 }
    );
  }

  // Fetch candidates whose name matches, then check phone on the server
  // (avoids passing raw phone into the OR filter which could be tricky with + signs)
  const { data: candidates } = await admin
    .from("member_registrations")
    .select("id, name, phone")
    .ilike("name", `%${cleanName}%`)
    .eq("slip_status", "approved")
    .order("created_at", { ascending: false })
    .limit(20);

  if (!candidates || candidates.length === 0) {
    return NextResponse.json(
      { error: "No approved membership found. Check your name and phone number." },
      { status: 404 }
    );
  }

  // Find one where the stored phone (stripped) contains the entered digits
  const match = candidates.find((c) => {
    if (!c.phone) return false;
    const stored = c.phone.replace(/[\s\-().+]/g, "");
    // Allow last-N-digits match: "1234567890" matches "+661234567890"
    return stored.endsWith(cleanPhone) || cleanPhone.endsWith(stored) || stored === cleanPhone;
  });

  if (!match) {
    return NextResponse.json(
      { error: "Name found but phone number doesn't match. Please check both fields." },
      { status: 404 }
    );
  }

  return NextResponse.json({ id: match.id, token: signMemberId(match.id) });
}

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  verifyStaffPin,
  signEntry, signWrite,
  ENTRY_COOKIE, WRITE_COOKIE,
  ENTRY_TTL_MS, WRITE_TTL_MS,
} from "@/lib/staff-pin";

/**
 * POST /api/staff-pin/dashboard-verify
 * Body: { pin: string, purpose: "entry" | "write" }
 *
 * Step-up auth for the dashboard. Caller must already be authenticated
 * (Supabase login session) — this endpoint just verifies their PIN against
 * profiles.pin and issues the corresponding signed cookie:
 *
 *   purpose=entry  →  ng_pin_entry  (4-hour TTL, gates /admin/*)
 *   purpose=write  →  ng_pin_write  (15-min TTL, gates protected writes)
 *
 * Rate-limited at 5 wrong / 10 min → 30 min lockout per user.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const pin     = typeof body.pin     === "string" ? body.pin.trim()     : "";
  const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "entry";

  if (!/^\d{4,8}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be 4 to 8 digits" }, { status: 400 });
  }
  if (purpose !== "entry" && purpose !== "write") {
    return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
  }

  const result = await verifyStaffPin(user.id, pin);

  if (!result.ok) {
    if (result.reason === "no_pin") {
      return NextResponse.json({ error: "No PIN set. Ask admin to set one." }, { status: 400 });
    }
    if (result.reason === "locked" || result.reason === "wrong_locked") {
      return NextResponse.json(
        { error: "Too many wrong PINs. Please try again later.", retry_after_minutes: result.retryAfterMinutes },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "Incorrect PIN", attempts_left: result.attemptsLeft },
      { status: 401 },
    );
  }

  // ── Success: issue the cookie matching the requested purpose ──────────────
  const { value, expiresAt } =
    purpose === "entry" ? signEntry(user.id) : signWrite(user.id);

  const res = NextResponse.json({ ok: true, expires_at: expiresAt.toISOString() });
  res.cookies.set({
    name:     purpose === "entry" ? ENTRY_COOKIE : WRITE_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    path:     "/",
    maxAge:   Math.floor((purpose === "entry" ? ENTRY_TTL_MS : WRITE_TTL_MS) / 1000),
  });
  return res;
}

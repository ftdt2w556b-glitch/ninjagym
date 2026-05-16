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
 * Step-up auth for the dashboard. The centre device runs on one shared
 * NinjaGym login, so the PIN typed here identifies the real staff member
 * (Naing / Win / Rick) and decides:
 *
 *   purpose=entry  →  ng_pin_entry  (4h device cookie, unlocks /admin/*)
 *   purpose=write  →  ng_pin_write  (15min soft cookie, used for write attribution)
 *
 * Rate-limited at 5 wrong / 10 min  →  30 min lockout per IP. Successful
 * entry clears the IP counter.
 *
 * Caller must still be in some logged-in Supabase session (defence in depth
 * against random internet hits — the dashboard requires it everywhere else).
 *
 * Response on success includes the resolved actor so the client can render
 * "Verified as Naing" inline before submitting the actual write.
 */
function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

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

  const ip = clientIp(request);
  const result = await verifyStaffPin(pin, ip);

  if (!result.ok) {
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
  const { value, expiresAt } = purpose === "entry" ? signEntry() : signWrite();
  const cookieName = purpose === "entry" ? ENTRY_COOKIE : WRITE_COOKIE;
  const cookieTtl  = purpose === "entry" ? ENTRY_TTL_MS : WRITE_TTL_MS;

  const res = NextResponse.json({
    ok: true,
    actor: result.actor,           // { kind, id, name } — caller renders "Verified as Naing"
    expires_at: expiresAt.toISOString(),
  });
  res.cookies.set({
    name:     cookieName,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    path:     "/",
    maxAge:   Math.floor(cookieTtl / 1000),
  });
  return res;
}

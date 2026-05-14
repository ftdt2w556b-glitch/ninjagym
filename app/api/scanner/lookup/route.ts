import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { signMemberId } from "@/lib/member-token";

/**
 * GET /api/scanner/lookup?pin=1234
 * Public endpoint, no login required. Used by /my-membership and the staff scanner.
 *
 * Brute-force protection:
 * - 8 wrong PINs from the same IP within a 10-minute window → 30-minute lockout
 * - Successful lookup clears that IP's counter
 * - State lives in `lookup_attempts` (per-IP row, upserted atomically)
 */

const MAX_FAILS        = 8;
const WINDOW_MS        = 10 * 60_000; // 10 min
const LOCKOUT_MS       = 30 * 60_000; // 30 min

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function GET(request: NextRequest) {
  const pin = request.nextUrl.searchParams.get("pin");
  if (!pin || isNaN(Number(pin))) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 400 });
  }

  const ip    = clientIp(request);
  const admin = createAdminClient();

  // ── Rate-limit check ─────────────────────────────────────────────
  const { data: state } = await admin
    .from("lookup_attempts")
    .select("fails, locked_until, updated_at")
    .eq("ip", ip)
    .maybeSingle();

  const now = Date.now();
  if (state?.locked_until && new Date(state.locked_until).getTime() > now) {
    const minutesLeft = Math.ceil(
      (new Date(state.locked_until).getTime() - now) / 60_000,
    );
    return NextResponse.json(
      { error: "Too many attempts. Please try again later.", retry_after_minutes: minutesLeft },
      { status: 429 },
    );
  }

  // If the previous attempt is older than WINDOW_MS, the counter resets.
  const lastUpdate = state?.updated_at ? new Date(state.updated_at).getTime() : 0;
  const stale      = !state || (now - lastUpdate) > WINDOW_MS;
  const baseFails  = stale ? 0 : (state?.fails ?? 0);

  // ── Member lookup ────────────────────────────────────────────────
  const { data: member } = await admin
    .from("member_registrations")
    .select("id, name, phone, email, membership_type, slip_status, sessions_remaining, expires_at, kids_names, kids_count")
    .eq("pin", Number(pin))
    .maybeSingle();

  if (member) {
    // Clear this IP's counter on success, legitimate users shouldn't accrue.
    await admin
      .from("lookup_attempts")
      .upsert({ ip, fails: 0, locked_until: null, updated_at: new Date().toISOString() });
    return NextResponse.json({ ...member, token: signMemberId(member.id) });
  }

  // ── Miss: increment, possibly lock ──────────────────────────────
  const newFails  = baseFails + 1;
  const willLock  = newFails >= MAX_FAILS;
  const lockedUntil = willLock ? new Date(now + LOCKOUT_MS).toISOString() : null;

  await admin
    .from("lookup_attempts")
    .upsert({
      ip,
      fails:        willLock ? 0 : newFails, // reset counter on lock; next attempt starts fresh after the lockout
      locked_until: lockedUntil,
      updated_at:   new Date().toISOString(),
    });

  if (willLock) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later.", retry_after_minutes: Math.ceil(LOCKOUT_MS / 60_000) },
      { status: 429 },
    );
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

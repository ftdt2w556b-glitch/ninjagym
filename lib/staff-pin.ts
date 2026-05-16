/**
 * Staff PIN step-up auth for the admin dashboard.
 *
 * Threat model recap: the centre keeps ONE shared login (NinjaGym account)
 * always signed in. Real staff identity (Naing, Win, etc.) lives in the
 * pos_staff and profiles tables. The PIN typed at action time identifies
 * the actor for that action.
 *
 * Public surface:
 *  • verifyStaffPin(pin, ip)  — IP-rate-limited, scans pos_staff + profiles
 *                                 with bcrypt.compare, returns the actor.
 *  • signEntry / signWrite    — HMAC-signed cookie values (device-bound).
 *  • readSignedCookie         — parse + verify a cookie value (just expiry).
 *
 * Rate limit:  5 wrong / 10 min  →  30 min lockout, per IP.
 *   Per-user makes no sense here since the auth session is shared.
 *   A successful entry clears the IP counter.
 */

import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/server";

const SECRET =
  process.env.MEMBER_TOKEN_SECRET ?? "ng-dev-secret-replace-in-prod";

export const ENTRY_TTL_MS = 4 * 60 * 60 * 1000;   // 4 hours
export const WRITE_TTL_MS = 15 * 60 * 1000;       //  15 min — soft "I just verified" memory

const MAX_FAILS  = 5;
const WINDOW_MS  = 10 * 60_000;
const LOCKOUT_MS = 30 * 60_000;

export const ENTRY_COOKIE = "ng_pin_entry";
export const WRITE_COOKIE = "ng_pin_write";

// ── Actor resolved from a PIN ────────────────────────────────────────────────
// pos_staff: PIN-only kiosk worker (no dashboard login). actor_id is bigint.
// profile:   user with a Supabase auth account too. actor_id is uuid.
export type StaffActor = {
  kind: "pos_staff" | "profile";
  id:   string;
  name: string;
};

export type VerifyResult =
  | { ok: true; actor: StaffActor }
  | { ok: false; reason: "locked";       retryAfterMinutes: number }
  | { ok: false; reason: "wrong";        attemptsLeft: number }
  | { ok: false; reason: "wrong_locked"; retryAfterMinutes: number };

/**
 * Verifies a PIN against the full staff roster (pos_staff + profiles).
 * Returns the actor on success. Rate-limited by IP because the shared
 * login means per-user limits are meaningless.
 */
export async function verifyStaffPin(pin: string, ip: string): Promise<VerifyResult> {
  if (!/^\d{4,8}$/.test(pin)) {
    return { ok: false, reason: "wrong", attemptsLeft: MAX_FAILS - 1 };
  }

  const admin = createAdminClient();
  const now = Date.now();

  // ── Rate-limit check ──────────────────────────────────────────────────────
  const { data: state } = await admin
    .from("staff_pin_attempts")
    .select("fails, locked_until, updated_at")
    .eq("ip", ip)
    .maybeSingle();

  if (state?.locked_until && new Date(state.locked_until).getTime() > now) {
    return {
      ok: false,
      reason: "locked",
      retryAfterMinutes: Math.ceil(
        (new Date(state.locked_until).getTime() - now) / 60_000,
      ),
    };
  }

  const lastUpdate = state?.updated_at ? new Date(state.updated_at).getTime() : 0;
  const stale      = !state || (now - lastUpdate) > WINDOW_MS;
  const baseFails  = stale ? 0 : (state?.fails ?? 0);

  // ── PIN scan: pos_staff first (the busy-day path), then profiles ──────────
  const actor = await scanForPin(pin);

  if (actor) {
    // Success → clear the counter for this IP.
    await admin
      .from("staff_pin_attempts")
      .upsert({ ip, fails: 0, locked_until: null, updated_at: new Date().toISOString() });
    return { ok: true, actor };
  }

  // Miss → increment, possibly lock.
  const newFails    = baseFails + 1;
  const willLock    = newFails >= MAX_FAILS;
  const lockedUntil = willLock ? new Date(now + LOCKOUT_MS).toISOString() : null;

  await admin
    .from("staff_pin_attempts")
    .upsert({
      ip,
      fails:        willLock ? 0 : newFails,
      locked_until: lockedUntil,
      updated_at:   new Date().toISOString(),
    });

  if (willLock) {
    return {
      ok: false,
      reason: "wrong_locked",
      retryAfterMinutes: Math.ceil(LOCKOUT_MS / 60_000),
    };
  }
  return { ok: false, reason: "wrong", attemptsLeft: MAX_FAILS - newFails };
}

/**
 * Bcrypt-compare the PIN against every active hash in pos_staff and
 * profiles. Linear scan is fine — a centre has a handful of staff, never
 * thousands.
 */
async function scanForPin(pin: string): Promise<StaffActor | null> {
  const admin = createAdminClient();

  // pos_staff (PIN-only workers — the common path)
  const { data: posRows } = await admin
    .from("pos_staff")
    .select("id, name, pin_hash, active")
    .eq("active", true)
    .not("pin_hash", "is", null);

  for (const r of posRows ?? []) {
    if (r.pin_hash && await bcrypt.compare(pin, r.pin_hash)) {
      return { kind: "pos_staff", id: String(r.id), name: r.name };
    }
  }

  // profiles (dashboard accounts with a PIN set — admins / managers / owners)
  const { data: profileRows } = await admin
    .from("profiles")
    .select("id, name, pin")
    .not("pin", "is", null);

  for (const r of profileRows ?? []) {
    if (r.pin && await bcrypt.compare(pin, r.pin)) {
      return { kind: "profile", id: r.id, name: r.name ?? "Unknown" };
    }
  }

  return null;
}

// ── Cookie signing / verification ────────────────────────────────────────────
// Format: "<expiresAtMs>.<hex-sig>"
// Sig = HMAC-SHA256(expiresAtMs).slice(0, 32)
//
// Device-bound cookies don't carry the actor — entry just means "this device
// is unlocked until X". Every protected write must re-verify with a fresh
// PIN that names the actor. The optional write cookie is a 15-min soft hint
// the UI can use to skip the modal during a burst of approvals.

function sign(expiresAt: number): string {
  return createHmac("sha256", SECRET)
    .update(String(expiresAt))
    .digest("hex")
    .slice(0, 32);
}

function signCookie(ttlMs: number): { value: string; expiresAt: Date } {
  const exp = Date.now() + ttlMs;
  return { value: `${exp}.${sign(exp)}`, expiresAt: new Date(exp) };
}

export function signEntry() { return signCookie(ENTRY_TTL_MS); }
export function signWrite() { return signCookie(WRITE_TTL_MS); }

/**
 * Returns true if the cookie value is well-formed, signed correctly, and
 * not yet expired. No identity is carried — that's intentional.
 */
export function readSignedCookie(raw: string | undefined): boolean {
  if (!raw) return false;
  const parts = raw.split(".");
  if (parts.length !== 2) return false;
  const [expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  const expected = sign(exp);
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

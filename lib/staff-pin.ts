/**
 * Staff PIN step-up auth for the admin dashboard.
 *
 * The PIN itself lives in profiles.pin (bcrypt hash) and is already used by
 * POS sale attribution. This module adds:
 *
 *  • verifyStaffPin(userId, pin)  — bcrypt.compare + per-user rate limit
 *  • signEntry / signWrite        — HMAC-signed cookie values: "<userId>.<expiresMs>.<sig>"
 *  • readEntry / readWrite        — parse + verify a cookie value
 *  • ENTRY_TTL_MS / WRITE_TTL_MS  — single source of truth for the windows
 *
 * Rate limit mirrors /api/scanner/lookup so the patterns stay consistent:
 *   5 wrong PINs / 10 min  →  30 min lockout
 * Counter resets on a successful entry.
 */

import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/server";

const SECRET =
  process.env.MEMBER_TOKEN_SECRET ?? "ng-dev-secret-replace-in-prod";

// Entry covers the dashboard for a 4-hour shift, writes refresh every 15 min.
export const ENTRY_TTL_MS = 4 * 60 * 60 * 1000;   // 4 hours
export const WRITE_TTL_MS = 15 * 60 * 1000;       //  15 min

const MAX_FAILS  = 5;
const WINDOW_MS  = 10 * 60_000;
const LOCKOUT_MS = 30 * 60_000;

// ── Cookie names (exported so the route + middleware agree) ──────────────────
export const ENTRY_COOKIE = "ng_pin_entry";
export const WRITE_COOKIE = "ng_pin_write";

// ── PIN verification with per-user rate-limit ────────────────────────────────

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no_pin" }
  | { ok: false; reason: "locked"; retryAfterMinutes: number }
  | { ok: false; reason: "wrong"; attemptsLeft: number }
  | { ok: false; reason: "wrong_locked"; retryAfterMinutes: number };

export async function verifyStaffPin(userId: string, pin: string): Promise<VerifyResult> {
  if (!/^\d{4,8}$/.test(pin)) {
    return { ok: false, reason: "wrong", attemptsLeft: MAX_FAILS - 1 };
  }

  const admin = createAdminClient();
  const now = Date.now();

  // Read current rate-limit state.
  const { data: state } = await admin
    .from("staff_pin_attempts")
    .select("fails, locked_until, updated_at")
    .eq("user_id", userId)
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

  // Window expiry resets the counter.
  const lastUpdate = state?.updated_at ? new Date(state.updated_at).getTime() : 0;
  const stale      = !state || (now - lastUpdate) > WINDOW_MS;
  const baseFails  = stale ? 0 : (state?.fails ?? 0);

  // Compare against profiles.pin.
  const { data: profile } = await admin
    .from("profiles")
    .select("pin")
    .eq("id", userId)
    .single();

  if (!profile?.pin) {
    // No PIN set → caller can decide to let owner/admin through or force setup.
    return { ok: false, reason: "no_pin" };
  }

  const match = await bcrypt.compare(pin, profile.pin);

  if (match) {
    // Reset counter on success.
    await admin
      .from("staff_pin_attempts")
      .upsert({ user_id: userId, fails: 0, locked_until: null, updated_at: new Date().toISOString() });
    return { ok: true };
  }

  // Wrong PIN — increment, possibly lock.
  const newFails  = baseFails + 1;
  const willLock  = newFails >= MAX_FAILS;
  const lockedUntil = willLock ? new Date(now + LOCKOUT_MS).toISOString() : null;

  await admin
    .from("staff_pin_attempts")
    .upsert({
      user_id:      userId,
      fails:        willLock ? 0 : newFails, // reset on lock, next attempt starts fresh
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

// ── Cookie signing / verification ────────────────────────────────────────────
// Format: "<userId>.<expiresAtMs>.<hex-sig>"
// Sig = HMAC-SHA256(userId + "." + expiresAtMs).slice(0, 32)

function sign(userId: string, expiresAt: number): string {
  return createHmac("sha256", SECRET)
    .update(`${userId}.${expiresAt}`)
    .digest("hex")
    .slice(0, 32);
}

function signCookie(userId: string, ttlMs: number): { value: string; expiresAt: Date } {
  const exp = Date.now() + ttlMs;
  const value = `${userId}.${exp}.${sign(userId, exp)}`;
  return { value, expiresAt: new Date(exp) };
}

export function signEntry(userId: string) { return signCookie(userId, ENTRY_TTL_MS); }
export function signWrite(userId: string) { return signCookie(userId, WRITE_TTL_MS); }

/**
 * Returns the verified userId from a cookie value, or null if the cookie
 * is missing / malformed / signature-mismatched / expired.
 */
export function readSignedCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;

  const expected = sign(userId, exp);
  // Constant-time compare.
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? userId : null;
}

/**
 * Server-side helper used by protected write endpoints to resolve the
 * actor for an action. Two outcomes:
 *
 *   { actor }     →  proceed with the action and log to staff_actions
 *   { response }  →  return that NextResponse as-is (401 / 403 / 429)
 *
 * Resolution order:
 *   1. Caller must have a Supabase session at all (else 401 with no
 *      pin_required hint, the client should re-login).
 *   2. If the session user is admin or owner → bypass: actor is synthesized
 *      from their profile row. They never see a PIN modal.
 *   3. If a valid ng_pin_write cookie is present → actor from cookie.
 *   4. If a valid pos_auth cookie is present → POS context, bypass with a
 *      synthetic 'POS kiosk' actor. POS already runs its own PIN flow plus
 *      cash_sales.staff_name attribution, so a second PIN here would be
 *      redundant and would break programmatic POS → /api/payments calls.
 *   5. Else 401 { code: "pin_required" } so the client opens the PIN modal.
 *
 * Best-effort logging is *not* done here — that's the caller's job after
 * the action succeeds, via lib/staff-actions.logStaffAction().
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient, createAdminClient } from "@/lib/supabase/server";
import { readWriteCookie, WRITE_COOKIE, type StaffActor } from "@/lib/staff-pin";

export type WriteAuth =
  | { actor: StaffActor; sessionUserId: string; ip: string }
  | { response: NextResponse };

export async function requireWritePin(request: NextRequest): Promise<WriteAuth> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }

  const ip = clientIp(request);

  // Admin / owner bypass — their session user_id IS their identity.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (profile && (profile.role === "admin" || profile.role === "owner")) {
    return {
      actor: { kind: "profile", id: user.id, name: profile.name ?? "Admin" },
      sessionUserId: user.id,
      ip,
    };
  }

  const cookieStore = await cookies();

  // Fresh dashboard write cookie wins.
  const actor = readWriteCookie(cookieStore.get(WRITE_COOKIE)?.value);
  if (actor) {
    return { actor, sessionUserId: user.id, ip };
  }

  // POS bypass: only honored when the request actually originates from the
  // /pos kiosk page. The centre browser also carries pos_auth from earlier
  // POS use, so we can't trust the cookie alone — without the Referer check
  // a dashboard click would silently fall through here and get attributed
  // to a generic 'POS' actor instead of opening the PIN modal.
  const referer = request.headers.get("referer") ?? "";
  const fromPos = (() => {
    try {
      const u = new URL(referer);
      return u.pathname.startsWith("/pos");
    } catch {
      return false;
    }
  })();
  if (fromPos) {
    const posAuth = cookieStore.get("pos_auth")?.value;
    if (posAuth) {
      const { data: pwSetting } = await admin
        .from("settings")
        .select("value")
        .eq("key", "pos_password")
        .maybeSingle();
      const expected = pwSetting?.value ?? process.env.POS_PASSWORD ?? null;
      const posOk = expected ? posAuth === expected : posAuth === "unlocked";
      if (posOk) {
        return {
          actor: { kind: "pos_staff", id: "kiosk", name: "POS" },
          sessionUserId: user.id,
          ip,
        };
      }
    }
  }

  // No path matched → ask the dashboard client to open the PIN modal.
  return {
    response: NextResponse.json(
      { error: "Staff PIN required", code: "pin_required" },
      { status: 401 },
    ),
  };
}

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

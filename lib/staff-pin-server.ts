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
 *   3. Else read the ng_pin_write cookie. If valid → actor from cookie.
 *   4. Else 401 { code: "pin_required" } so the client opens the PIN modal.
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

  // Everyone else needs a valid write cookie.
  const cookieStore = await cookies();
  const actor = readWriteCookie(cookieStore.get(WRITE_COOKIE)?.value);
  if (!actor) {
    return {
      response: NextResponse.json(
        { error: "Staff PIN required", code: "pin_required" },
        { status: 401 },
      ),
    };
  }

  return { actor, sessionUserId: user.id, ip };
}

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

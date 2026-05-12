import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyMemberToken } from "@/lib/member-token";

/**
 * PATCH /api/members/[id]/notify-prefs
 * Body: { token: cardToken, notify_prefs: { checkin?, low_sessions?, milestone? } }
 *
 * Parent-facing endpoint for toggling email notifications on their own card.
 * Token-gated (same signed token used by /qr/card/[id]). Only the three known
 * boolean keys are accepted — anything else is dropped to prevent privilege
 * escalation via this route.
 */
const ALLOWED_KEYS = new Set(["checkin", "low_sessions", "milestone"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const memberId = Number(id);
  if (isNaN(memberId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const token        = body.token as string | undefined;
  const notify_prefs = body.notify_prefs as Record<string, unknown> | undefined;

  if (!verifyMemberToken(memberId, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!notify_prefs || typeof notify_prefs !== "object") {
    return NextResponse.json({ error: "notify_prefs required" }, { status: 400 });
  }

  const cleaned: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(notify_prefs)) {
    if (ALLOWED_KEYS.has(k) && typeof v === "boolean") cleaned[k] = v;
  }
  if (Object.keys(cleaned).length === 0) {
    return NextResponse.json({ error: "No valid prefs supplied" }, { status: 400 });
  }

  const admin = createAdminClient();
  // Merge: read current prefs and apply only the keys we accepted so a partial
  // update doesn't wipe untouched flags.
  const { data: current } = await admin
    .from("member_registrations")
    .select("notify_prefs")
    .eq("id", memberId)
    .maybeSingle();
  const merged = { ...((current?.notify_prefs as Record<string, boolean> | null) ?? {}), ...cleaned };

  const { error } = await admin
    .from("member_registrations")
    .update({ notify_prefs: merged })
    .eq("id", memberId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, notify_prefs: merged });
}

import { NextRequest, NextResponse } from "next/server";
import { requireWritePin } from "@/lib/staff-pin-server";

/**
 * GET /api/staff-pin/check-write
 *
 * A no-op endpoint used by reveal-on-demand UI (e.g. unmasking member
 * contact info). Returns 200 + the actor's name if the caller already has
 * a valid ng_pin_write cookie (or admin/owner bypass), otherwise 401 +
 * code:pin_required so the client-side StaffPinProvider modal opens.
 *
 * No side effects — this is purely a "is the PIN cookie fresh?" check.
 */
export async function GET(request: NextRequest) {
  const auth = await requireWritePin(request);
  if ("response" in auth) return auth.response;
  return NextResponse.json({ ok: true, actor_name: auth.actor.name });
}

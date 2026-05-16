import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireWritePin } from "@/lib/staff-pin-server";
import { readWriteCookieFull, WRITE_COOKIE } from "@/lib/staff-pin";

/**
 * GET /api/staff-pin/check-write
 *
 * Two roles:
 *
 * 1. Reveal-on-demand UI uses this to "do I need to open the PIN modal?"
 *    Returns 200 if a valid write cookie OR admin/owner bypass is present,
 *    otherwise 401 + code:pin_required so the client modal opens.
 *
 * 2. The PIN-window status chip in the dashboard header polls this to
 *    rehydrate after a page refresh. On 200 we include the actor name and
 *    expires_at (when present in the cookie) so the chip can render a
 *    live countdown without needing to remember state across reloads.
 *
 * Admin/owner sessions hit the bypass path in requireWritePin — they don't
 * carry a write cookie, so the response omits expires_at. The UI treats
 * a missing expires_at as 'bypass, no countdown needed'.
 */
export async function GET(request: NextRequest) {
  const auth = await requireWritePin(request);
  if ("response" in auth) return auth.response;

  // Cookie-backed write sessions: expose actor + expiry for the header chip.
  const cookieStore = await cookies();
  const cookieData  = readWriteCookieFull(cookieStore.get(WRITE_COOKIE)?.value);

  return NextResponse.json({
    ok:          true,
    actor:       auth.actor,
    actor_name:  auth.actor.name,
    expires_at:  cookieData?.expiresAt.toISOString() ?? null,
  });
}

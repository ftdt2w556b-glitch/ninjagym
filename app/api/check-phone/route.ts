import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/check-phone?phone=xxx&email=yyy
 * Lightweight duplicate-detection for the public /join form. Returns the
 * first matching approved parent row so the UI can bounce a returning
 * parent to /my-membership instead of letting them register a 2nd card.
 *
 * Matching:
 *  - phone — digits-only suffix in either direction (handles +66 vs 0
 *    prefixes, spaces, dashes, parens). Scans all approved parent rows;
 *    the old version's LIMIT 50 was the bug that let most dupes slip past.
 *  - email — exact case-insensitive trimmed match.
 *
 * Top-ups excluded (parent_member_id IS NULL). Either param works alone
 * or together; phone wins when both match different members (rare).
 *
 * Intentionally unauthenticated and side-effect-free. It does leak
 * whether a given phone/email is registered, which is a small
 * enumeration vector but worth it to stop new duplicates landing.
 */
export async function GET(request: NextRequest) {
  const phoneRaw = request.nextUrl.searchParams.get("phone") ?? "";
  const emailRaw = request.nextUrl.searchParams.get("email") ?? "";

  const phoneDigits = phoneRaw.replace(/[^0-9]/g, "");
  const emailNorm   = emailRaw.trim().toLowerCase();

  // Bail on too-short inputs so the join page can call this with each
  // keystroke without us hammering the DB on '06...' / '06...etc'.
  const phoneReady = phoneDigits.length >= 7;
  const emailReady = emailNorm.length   >= 5 && emailNorm.includes("@");
  if (!phoneReady && !emailReady) {
    return NextResponse.json({ found: false });
  }

  const admin = createAdminClient();

  // ── Phone match (covers the majority of duplicates) ─────────────────────
  if (phoneReady) {
    // Fetch all approved parent rows with a phone, then do the suffix
    // match in JS. ~500 rows so this is well under the request budget,
    // and it keeps us free of stored procs for normalising digits.
    const { data: candidates } = await admin
      .from("member_registrations")
      .select("id, name, phone, kids_names, pin")
      .eq("slip_status", "approved")
      .is("parent_member_id", null)
      .not("phone", "is", null);

    const match = (candidates ?? []).find((c) => {
      if (!c.phone) return false;
      const stored = String(c.phone).replace(/[^0-9]/g, "");
      if (stored.length < 6) return false;
      return stored === phoneDigits
          || stored.endsWith(phoneDigits)
          || phoneDigits.endsWith(stored);
    });

    if (match) {
      return NextResponse.json({
        found:      true,
        id:         match.id,
        name:       match.name,
        kids_names: match.kids_names,
        pin:        match.pin,
        by:         "phone",
      });
    }
  }

  // ── Email fallback ──────────────────────────────────────────────────────
  if (emailReady) {
    const { data: emailHits } = await admin
      .from("member_registrations")
      .select("id, name, kids_names, pin, email")
      .eq("slip_status", "approved")
      .is("parent_member_id", null)
      .ilike("email", emailNorm)
      .limit(1);

    const m = emailHits?.[0];
    if (m?.id) {
      return NextResponse.json({
        found:      true,
        id:         m.id,
        name:       m.name,
        kids_names: m.kids_names,
        pin:        m.pin,
        by:         "email",
      });
    }
  }

  return NextResponse.json({ found: false });
}

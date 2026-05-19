import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/check-phone?phone=xxx&email=yyy
 * Lightweight duplicate-detection for the public /join form. Returns the
 * first matching approved parent row so the UI can bounce a returning
 * parent to /my-membership instead of letting them register a 2nd card.
 *
 * Matching strategy (corrected May 2026 after the Diana false positive):
 *
 *  - Both phones are reduced to a CANONICAL Thai-style core via
 *    canonicalThai(): drop any leading 0066 / 66 country code, then any
 *    leading Thai 0, then keep the remaining digits (typically 9 for a
 *    Thai mobile). Compare canonicals for exact equality.
 *  - Falls back to exact last-8 digit match for non-Thai numbers so UK,
 *    US, etc. numbers still de-dupe correctly without bleeding suffix
 *    matches across unrelated families.
 *  - Old behaviour was endsWith() in both directions, which falsely
 *    matched any new parent whose phone shared a 7+ digit suffix with
 *    an existing record. Diana stored as '+660990708073' (typo: extra 0)
 *    pulled in any new Thai number ending in '0708073', etc.
 *
 *  - Email: exact case-insensitive trimmed match. Unchanged.
 *
 * Top-ups excluded (parent_member_id IS NULL). Either param works alone
 * or together; phone wins when both match different members (rare).
 */

function canonicalThai(digits: string): string | null {
  // Returns the canonical form for comparison, or null if the number is
  // too short to safely compare. Strips Thai country codes and leading 0.
  if (!digits || digits.length < 8) return null;
  let core = digits;
  if (core.startsWith("0066"))      core = core.slice(4);
  else if (core.startsWith("66"))   core = core.slice(2);
  if (core.startsWith("0"))         core = core.slice(1);
  if (core.length < 8) return null;
  return core;
}

function phonesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ca = canonicalThai(a);
  const cb = canonicalThai(b);
  if (ca && cb && ca === cb) return true;
  // Belt-and-suspenders for non-Thai numbers: exact last-8 digit match.
  // Keeps UK / US / etc. comparisons working without bleeding suffix
  // matches across unrelated families.
  if (a.length >= 8 && b.length >= 8 && a.slice(-8) === b.slice(-8)) return true;
  return false;
}

export async function GET(request: NextRequest) {
  const phoneRaw = request.nextUrl.searchParams.get("phone") ?? "";
  const emailRaw = request.nextUrl.searchParams.get("email") ?? "";

  const phoneDigits = phoneRaw.replace(/[^0-9]/g, "");
  const emailNorm   = emailRaw.trim().toLowerCase();

  // Bail on too-short inputs so the join page can call this with each
  // keystroke without us hammering the DB on '06...' / '06...' etc.
  const phoneReady = phoneDigits.length >= 8;
  const emailReady = emailNorm.length   >= 5 && emailNorm.includes("@");
  if (!phoneReady && !emailReady) {
    return NextResponse.json({ found: false });
  }

  const admin = createAdminClient();

  // ── Phone match (covers the majority of duplicates) ─────────────────────
  if (phoneReady) {
    const { data: candidates } = await admin
      .from("member_registrations")
      .select("id, name, phone, kids_names, pin")
      .eq("slip_status", "approved")
      .is("parent_member_id", null)
      .not("phone", "is", null);

    const match = (candidates ?? []).find((c) => {
      const stored = String(c.phone ?? "").replace(/[^0-9]/g, "");
      return phonesMatch(stored, phoneDigits);
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

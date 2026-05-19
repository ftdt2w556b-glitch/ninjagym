import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/check-phone?name=...&phone=...&email=...
 *
 * Duplicate detection for the /join form. Returns the first existing
 * approved parent row that matches the submitted info on AT LEAST TWO
 * of three signals: name, phone, email.
 *
 * Why 2-of-3:
 *   Earlier the matcher fired on a single signal (just phone OR just
 *   email). That cost three families on 2026-05-19 when fuzzy phone
 *   matches on stored numbers with typos pointed parents at unrelated
 *   existing cards. Requiring two independent signals to align makes
 *   the dedupe robust to a single-field collision while still catching
 *   real duplicates (which by definition match all three).
 *
 *   The trade-off the other way:
 *   A genuine returning parent who changed their phone AND their email
 *   between visits will register a new card. Acceptable because they
 *   look like a new family to us; staff can merge later if needed via
 *   /admin/members. Far better than turning new families away at the
 *   door.
 *
 * Response shape:
 *   { found: true,  id, name, kids_names, pin, matched_fields: [...] }
 *   { found: false }
 *
 * matched_fields lists the fields that aligned so the UI (and staff)
 * can verify the call is correct.
 */

function canonicalThai(digits: string): string | null {
  if (!digits || digits.length < 8) return null;
  let core = digits;
  if (core.startsWith("0066"))      core = core.slice(4);
  else if (core.startsWith("66"))   core = core.slice(2);
  if (core.startsWith("0"))         core = core.slice(1);
  return core.length >= 8 ? core : null;
}

function phonesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ca = canonicalThai(a);
  const cb = canonicalThai(b);
  if (ca && cb && ca === cb) return true;
  return a.length >= 8 && b.length >= 8 && a.slice(-8) === b.slice(-8);
}

function normName(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  return na.length >= 3 && na === nb;
}

function emailsMatch(a: string, b: string): boolean {
  const na = (a ?? "").trim().toLowerCase();
  const nb = (b ?? "").trim().toLowerCase();
  return na.length >= 5 && na.includes("@") && na === nb;
}

export async function GET(request: NextRequest) {
  const nameRaw  = request.nextUrl.searchParams.get("name")  ?? "";
  const phoneRaw = request.nextUrl.searchParams.get("phone") ?? "";
  const emailRaw = request.nextUrl.searchParams.get("email") ?? "";

  const phoneDigits = phoneRaw.replace(/[^0-9]/g, "");
  const phoneReady  = phoneDigits.length >= 8;
  const nameReady   = normName(nameRaw).length >= 3;
  const emailReady  = emailRaw.includes("@") && emailRaw.trim().length >= 5;

  // Need at least 2 fields populated to even bother — 2-of-3 needs 2 to compare.
  const populated = (phoneReady ? 1 : 0) + (nameReady ? 1 : 0) + (emailReady ? 1 : 0);
  if (populated < 2) {
    return NextResponse.json({ found: false });
  }

  const admin = createAdminClient();
  const { data: candidates } = await admin
    .from("member_registrations")
    .select("id, name, phone, email, kids_names, pin")
    .eq("slip_status", "approved")
    .is("parent_member_id", null);

  for (const row of candidates ?? []) {
    const matched: string[] = [];
    if (nameReady  && namesMatch(nameRaw, String(row.name ?? "")))                                    matched.push("name");
    if (phoneReady && phonesMatch(phoneDigits, String(row.phone ?? "").replace(/[^0-9]/g, "")))       matched.push("phone");
    if (emailReady && emailsMatch(emailRaw, String(row.email ?? "")))                                 matched.push("email");

    if (matched.length >= 2) {
      return NextResponse.json({
        found:          true,
        id:             row.id,
        name:           row.name,
        kids_names:     row.kids_names,
        pin:            row.pin,
        matched_fields: matched,
      });
    }
  }

  return NextResponse.json({ found: false });
}

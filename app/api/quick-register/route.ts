import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// Session-based types get sessions_remaining = 1 on creation
const SESSION_TYPES = new Set([
  "climb_unguided", "session_group", "session_1to1",
  "day_camp", "combo_game_train", "all_day",
]);

/**
 * POST /api/quick-register
 *
 * Walk-in quick registration from the scanner page.
 * Cash → member approved immediately, cash_sale logged, drawer logged, auto checked-in.
 * PromptPay → member pending, no check-in (needs approval first).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      kids_names,
      kids_count,
      membership_type,
      payment_method,
      amount_paid,
      notes,
      staff_name,
    } = body;

    if (!name || !membership_type || !payment_method) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const isCash = payment_method === "cash";

    // Generate unique 4-digit PIN
    let pin: number | null = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = Math.floor(1000 + Math.random() * 9000);
      const { data: existing } = await admin
        .from("member_registrations")
        .select("id")
        .eq("pin", candidate)
        .maybeSingle();
      if (!existing) { pin = candidate; break; }
    }

    const sessions_remaining = SESSION_TYPES.has(membership_type) ? 1 : null;
    const expires_at =
      membership_type === "monthly_flex"
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const slip_status = isCash ? "approved" : "pending_review";

    // ── 1. Create member record ───────────────────────────────────────
    const { data: member, error: memberError } = await admin
      .from("member_registrations")
      .insert({
        name,
        kids_names: kids_names || null,
        kids_count: Number(kids_count) || 1,
        membership_type,
        payment_method,
        amount_paid: amount_paid || null,
        notes: notes ? `[Walk-in] ${notes}` : "[Walk-in via scanner]",
        slip_status,
        slip_reviewed_at: isCash ? now : null,
        sessions_remaining,
        expires_at,
        pin,
      })
      .select("id, name")
      .single();

    if (memberError) throw memberError;

    // ── 2. Cash: log sale + drawer ────────────────────────────────────
    if (isCash) {
      const { data: sale } = await admin
        .from("cash_sales")
        .insert({
          sale_type: "membership",
          reference_id: member.id,
          amount: amount_paid || 0,
          items: [{ label: membership_type, qty: 1, unit: amount_paid || 0 }],
          staff_name: staff_name || null,
          drawer_opened: true,
          receipt_printed: false,
          notes: `Quick walk-in: ${name}`,
        })
        .select("id")
        .single();

      await admin.from("drawer_log").insert({
        staff_name: staff_name || null,
        reason: "cash_sale",
        sale_id: sale?.id ?? null,
      });
    }

    // ── 3. Auto check-in for cash ─────────────────────────────────────
    let checked_in = false;
    let sessions_after: number | null = sessions_remaining;

    if (isCash) {
      const { error: logErr } = await admin
        .from("attendance_logs")
        .insert({
          member_id: member.id,
          member_name: member.name,
          check_in_at: now,
          notes: "Walk-in quick register",
        });

      if (!logErr) {
        checked_in = true;
        if (sessions_remaining !== null && sessions_remaining > 0) {
          sessions_after = sessions_remaining - 1;
          await admin
            .from("member_registrations")
            .update({ sessions_remaining: sessions_after })
            .eq("id", member.id);
        }
      }
    }

    return NextResponse.json({
      id: member.id,
      name: member.name,
      checked_in,
      sessions_remaining: sessions_after,
      slip_status,
    });
  } catch (err: unknown) {
    console.error("POST /api/quick-register error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, staffId, staffType, staffName, amount, saleType, referenceId, items, notes, reason } = body;

    if (!staffId) {
      return NextResponse.json({ error: "staffId required" }, { status: 400 });
    }

    const admin = createAdminClient();

    if (action === "cash_sale") {
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }

      // Insert cash sale
      const { data: sale, error: saleError } = await admin
        .from("cash_sales")
        .insert({
          sale_type: saleType ?? "walkin",
          reference_id: referenceId ?? null,
          amount,
          items: items ?? null,
          processed_by: staffType === "profile" ? staffId : null,
          staff_name: staffName ?? null,
          drawer_opened: true,
          receipt_printed: false,
          notes: notes ?? null,
        })
        .select("id")
        .single();

      if (saleError) throw saleError;

      // Insert drawer log
      await admin.from("drawer_log").insert({
        opened_by: staffType === "profile" ? staffId : null,
        staff_name: staffName ?? null,
        reason: "cash_sale",
        sale_id: sale.id,
      });

      // Update reference record slip_status to approved if provided
      if (referenceId && saleType === "membership") {
        await admin
          .from("member_registrations")
          .update({ slip_status: "approved", slip_reviewed_at: new Date().toISOString() })
          .eq("id", referenceId);
      }

      return NextResponse.json({ saleId: sale.id });
    }

    if (action === "open_drawer") {
      const { error } = await admin.from("drawer_log").insert({
        opened_by: staffType === "profile" ? staffId : null,
        staff_name: staffName ?? null,
        reason: reason ?? "manual_open",
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("POST /api/pos/action error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

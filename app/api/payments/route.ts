import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const id = formData.get("id") as string;
  const action = formData.get("action") as string;
  const type = formData.get("type") as string; // 'member' | 'event' | 'shop'
  const notes = formData.get("notes") as string | null;

  if (!id || !action || !type) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const slip_status = action === "approve" ? "approved" : "rejected";
  const table =
    type === "member"
      ? "member_registrations"
      : type === "event"
      ? "event_bookings"
      : "shop_orders";

  const { error } = await admin
    .from(table)
    .update({
      slip_status,
      slip_reviewed_at: new Date().toISOString(),
      ...(notes ? { slip_notes: notes } : {}),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const referer = request.headers.get("referer") ?? "/admin/payments";
  return NextResponse.redirect(new URL(referer, request.url));
}

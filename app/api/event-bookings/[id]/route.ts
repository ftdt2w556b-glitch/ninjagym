import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * DELETE /api/event-bookings/[id]
 *
 * Permanently removes a birthday/event booking and everything linked to it:
 *  - The auto-created member_registrations row (event_booking_id = this booking)
 *  - Any cash_sales row that was written when the booking was approved cash
 *  - The event_bookings row itself
 *
 * Admin and owner only. Staff and manager can edit (separate flow) but cannot
 * delete because deletion is irreversible and removes the financial trail.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bookingId = Number(id);
  if (!bookingId || isNaN(bookingId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "owner"].includes(profile.role)) {
    return NextResponse.json(
      { error: "Forbidden, only admin or owner can delete bookings" },
      { status: 403 },
    );
  }

  // Linked cash_sales row (if any), then linked member_registrations row, then the booking.
  await admin
    .from("cash_sales")
    .delete()
    .eq("sale_type", "event")
    .eq("reference_id", bookingId);

  await admin
    .from("member_registrations")
    .delete()
    .eq("event_booking_id", bookingId);

  const { error } = await admin
    .from("event_bookings")
    .delete()
    .eq("id", bookingId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

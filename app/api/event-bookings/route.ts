import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEventConfirmation } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const email = formData.get("email") as string;
    const event_date = formData.get("event_date") as string;
    const time_slot = formData.get("time_slot") as string;
    const hours = formData.get("hours") as string;
    const num_hours = Number(formData.get("num_hours")) || 2;
    const num_kids = Number(formData.get("num_kids")) || 1;
    const birthday_child_name = formData.get("birthday_child_name") as string;
    const birthday_child_age = Number(formData.get("birthday_child_age")) || null;
    const payment_method = formData.get("payment_method") as string;
    const amount_paid = Number(formData.get("amount_paid")) || null;
    const notes = formData.get("notes") as string;
    const photographer_requested = formData.get("photographer_requested") === "true";
    const photographer_fee = photographer_requested ? 1500 : 0;
    const slipFile = formData.get("slip") as File | null;

    if (!name || !event_date || !time_slot) {
      return NextResponse.json({ error: "Name, event date, and time slot are required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Double-booking check
    const { data: existing } = await admin
      .from("event_bookings")
      .select("id")
      .eq("event_date", event_date)
      .eq("time_slot", time_slot)
      .in("slip_status", ["pending_review", "cash_pending", "approved"])
      .single();

    if (existing) {
      return NextResponse.json({ error: "This date and time slot is already booked" }, { status: 409 });
    }

    // Upload slip if provided
    let slip_image: string | null = null;
    let slip_uploaded_at: string | null = null;

    if (slipFile && slipFile.size > 0) {
      const ext = slipFile.name.split(".").pop() ?? "jpg";
      const fileName = `event_${Date.now()}.${ext}`;
      const arrayBuffer = await slipFile.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      const { error: uploadError } = await admin.storage
        .from("slips")
        .upload(fileName, buffer, { contentType: slipFile.type, upsert: false });

      if (!uploadError) {
        slip_image = fileName;
        slip_uploaded_at = new Date().toISOString();
      }
    }

    const slip_status = payment_method === "cash" ? "cash_pending" : "pending_review";

    const { data, error } = await admin
      .from("event_bookings")
      .insert({
        name,
        phone: phone || null,
        email: email || null,
        event_date,
        time_slot,
        hours: hours || null,
        num_hours,
        num_kids,
        birthday_child_name: birthday_child_name || null,
        birthday_child_age,
        payment_method,
        amount_paid,
        slip_image,
        slip_status,
        slip_uploaded_at,
        notes: notes || null,
        photographer_requested,
        photographer_fee,
      })
      .select("id")
      .single();

    if (error) throw error;

    // Auto-create a member page so the guest can receive photos and check-ins
    await admin.from("member_registrations").insert({
      name,
      phone: phone || null,
      email: email || null,
      kids_names: birthday_child_name || null,
      kids_count: num_kids,
      membership_type: "birthday_event",
      payment_method,
      amount_paid,
      slip_image,
      slip_status,
      slip_uploaded_at,
      notes: notes || null,
      sessions_remaining: null,
      event_booking_id: data.id,
    });

    // Send confirmation email (fire-and-forget)
    if (email) {
      sendEventConfirmation({
        to: email,
        name,
        eventDate: event_date,
        timeSlot: time_slot,
        numHours: num_hours,
        numKids: num_kids,
        totalAmount: amount_paid ?? 0,
        bookingId: data.id,
      }).catch((e) => console.error("Email send failed:", e));
    }

    return NextResponse.json({ id: data.id });
  } catch (err: unknown) {
    console.error("POST /api/event-bookings error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

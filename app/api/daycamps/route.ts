import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const email = formData.get("email") as string;
    const camp_date = formData.get("camp_date") as string;
    const num_kids = Number(formData.get("num_kids")) || 1;
    const kids_names = formData.get("kids_names") as string;
    const payment_method = formData.get("payment_method") as string;
    const amount_paid = Number(formData.get("amount_paid")) || null;
    const notes = formData.get("notes") as string;
    const slipFile = formData.get("slip") as File | null;

    if (!name || !camp_date) {
      return NextResponse.json({ error: "Name and camp date are required" }, { status: 400 });
    }

    const admin = createAdminClient();

    let slip_image: string | null = null;
    let slip_uploaded_at: string | null = null;

    if (slipFile && slipFile.size > 0) {
      const ext = slipFile.name.split(".").pop() ?? "jpg";
      const fileName = `camp_${Date.now()}.${ext}`;
      const buffer = new Uint8Array(await slipFile.arrayBuffer());

      const { error: uploadError } = await admin.storage
        .from("slips")
        .upload(fileName, buffer, { contentType: slipFile.type, upsert: false });

      if (!uploadError) {
        slip_image = fileName;
        slip_uploaded_at = new Date().toISOString();
      }
    }

    const slip_status = payment_method === "cash" ? "cash_pending" : "pending_review";

    // Store day camps as event_bookings with time_slot = "daycamp"
    const { data, error } = await admin
      .from("event_bookings")
      .insert({
        name,
        phone: phone || null,
        email: email || null,
        event_date: camp_date,
        time_slot: "morning", // day camps are all-day, use morning as default
        hours: "5",
        num_hours: 5,
        num_kids,
        birthday_child_name: kids_names || null,
        payment_method,
        amount_paid,
        slip_image,
        slip_status,
        slip_uploaded_at,
        notes: `DAY CAMP — ${notes || ""}`,
        photographer_requested: false,
        photographer_fee: 0,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ id: data.id });
  } catch (err: unknown) {
    console.error("POST /api/daycamps error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

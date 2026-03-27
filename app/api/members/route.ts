import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const email = formData.get("email") as string;
    const kids_names = formData.get("kids_names") as string;
    const kids_count = Number(formData.get("kids_count")) || 1;
    const membership_type = formData.get("membership_type") as string;
    const payment_method = formData.get("payment_method") as string;
    const amount_paid = Number(formData.get("amount_paid")) || null;
    const notes = formData.get("notes") as string;
    const slipFile = formData.get("slip") as File | null;

    if (!name || !membership_type) {
      return NextResponse.json({ error: "Name and membership type are required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Upload slip if provided
    let slip_image: string | null = null;
    let slip_uploaded_at: string | null = null;

    if (slipFile && slipFile.size > 0) {
      const ext = slipFile.name.split(".").pop() ?? "jpg";
      const fileName = `member_${Date.now()}.${ext}`;
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

    const slip_status =
      payment_method === "cash"
        ? "cash_pending"
        : payment_method === "stripe"
        ? "pending_review" // webhook will approve after successful payment
        : "pending_review";

    const { data, error } = await admin
      .from("member_registrations")
      .insert({
        name,
        phone: phone || null,
        email: email || null,
        kids_names: kids_names || null,
        kids_count,
        membership_type,
        payment_method,
        amount_paid,
        slip_image,
        slip_status,
        slip_uploaded_at,
        notes: notes || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ id: data.id });
  } catch (err: unknown) {
    console.error("POST /api/members error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

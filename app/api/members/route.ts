import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendMemberConfirmation } from "@/lib/email";
import { signMemberId } from "@/lib/member-token";
import { MEMBERSHIP_TYPES } from "@/lib/pricing";


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
    // Single-use sessions default to 1 so check-in decrements to 0 (making them filter out as used)
    const isBulkType = membership_type?.endsWith("_bulk");
    const isTimeBased = membership_type === "monthly_flex";
    const sessions_remaining = formData.get("sessions_remaining")
      ? Number(formData.get("sessions_remaining"))
      : isBulkType || isTimeBased ? null : 1;
    const parent_member_id = formData.get("parent_member_id") ? Number(formData.get("parent_member_id")) : null;
    const lang = (formData.get("lang") as string) || "en";
    const slipFile = formData.get("slip") as File | null;

    if (!name || !membership_type) {
      return NextResponse.json({ error: "Name and membership type are required" }, { status: 400 });
    }

    const admin = createAdminClient();

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

      if (uploadError) {
        console.error("Slip upload error:", JSON.stringify(uploadError));
      } else {
        slip_image = fileName;
        slip_uploaded_at = new Date().toISOString();
      }
    }

    // Cash → goes to POS queue so staff can collect payment, open drawer, give change.
    // PromptPay → auto-approved immediately; a pending_checkin is created so staff
    //   verifies the slip and approves check-in in one tap on the Pending page.
    // self_register / everything else → auto-approved (no payment yet).
    const slip_status =
      payment_method === "cash"   ? "cash_pending"   :
      payment_method === "stripe" ? "pending_review"  :
      "approved";

    // PromptPay auto-approves immediately — stamp slip_reviewed_at so it
    // appears in the Sales & Cash Report (which filters by that column).
    const slip_reviewed_at =
      payment_method === "promptpay" ? new Date().toISOString() : null;

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
        slip_reviewed_at,
        slip_uploaded_at,
        notes: notes || null,
        sessions_remaining,
        sessions_purchased: sessions_remaining ?? null,
        parent_member_id,
        pin,
      })
      .select("id")
      .single();

    if (error) throw error;

    // For PromptPay purchases only: create a pending_checkin immediately.
    // Cash goes through POS (separate drawer/change flow). PromptPay combines
    // slip verification + check-in into a single "Paid & In" tap on the Pending page.
    if (payment_method === "promptpay") {
      const membershipLabel =
        MEMBERSHIP_TYPES.find((m) => m.id === membership_type)?.label ?? membership_type;
      await admin.from("pending_checkins").insert({
        member_id:        data.id,
        member_name:      name,
        kids_count,
        membership_type,
        membership_label: membershipLabel,
        payment_method,
        amount_paid:      amount_paid ?? 0,
        slip_image:       slip_image ?? null,
      }).throwOnError();
    }

    // Send confirmation email (fire-and-forget, don't block response)
    if (email) {
      sendMemberConfirmation({
        to: email,
        name,
        membershipType: membership_type,
        memberId: data.id,
        paymentMethod: payment_method,
        kidsNames: kids_names,
        kidsCount: kids_count,
        registeredAt: new Date().toISOString(),
        pin: pin ?? undefined,
        lang,
      }).catch((e) => console.error("Email send failed:", e));
    }

    return NextResponse.json({ id: data.id, token: signMemberId(data.id) });
  } catch (err: unknown) {
    // Log full error for Vercel function logs
    console.error("POST /api/members error:", JSON.stringify(err, null, 2));
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : JSON.stringify(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

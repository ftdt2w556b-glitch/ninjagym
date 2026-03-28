import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendShopConfirmation } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const email = formData.get("email") as string;
    const payment_method = formData.get("payment_method") as string;
    const total_amount = Number(formData.get("total_amount")) || null;
    const itemsRaw = formData.get("items") as string;
    const slipFile = formData.get("slip") as File | null;

    if (!name || !itemsRaw) {
      return NextResponse.json({ error: "Name and items are required" }, { status: 400 });
    }

    const items = JSON.parse(itemsRaw);
    const admin = createAdminClient();

    let slip_image: string | null = null;
    let slip_uploaded_at: string | null = null;

    if (slipFile && slipFile.size > 0) {
      const ext = slipFile.name.split(".").pop() ?? "jpg";
      const fileName = `shop_${Date.now()}.${ext}`;
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
      .from("shop_orders")
      .insert({
        name,
        phone: phone || null,
        email: email || null,
        items,
        total_amount,
        payment_method,
        slip_image,
        slip_status,
        slip_uploaded_at,
      })
      .select("id")
      .single();

    if (error) throw error;

    // Send confirmation email (fire-and-forget)
    if (email) {
      sendShopConfirmation({
        to: email,
        name,
        items,
        totalAmount: total_amount ?? 0,
        orderId: data.id,
        paymentMethod: payment_method,
      }).catch((e) => console.error("Shop email send failed:", e));
    }

    return NextResponse.json({ id: data.id });
  } catch (err: unknown) {
    console.error("POST /api/shop-orders error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

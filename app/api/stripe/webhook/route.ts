import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const { referenceId, referenceType } = intent.metadata ?? {};

    if (referenceId && referenceType) {
      const admin = createAdminClient();
      const now = new Date().toISOString();

      if (referenceType === "member") {
        await admin
          .from("member_registrations")
          .update({ slip_status: "approved", slip_reviewed_at: now, payment_method: "stripe" })
          .eq("id", referenceId);
      } else if (referenceType === "event") {
        await admin
          .from("event_bookings")
          .update({ slip_status: "approved", slip_reviewed_at: now, payment_method: "stripe" })
          .eq("id", referenceId);
      } else if (referenceType === "shop") {
        await admin
          .from("shop_orders")
          .update({ slip_status: "approved", slip_reviewed_at: now, payment_method: "stripe" })
          .eq("id", referenceId);
      }
    }
  }

  return NextResponse.json({ received: true });
}

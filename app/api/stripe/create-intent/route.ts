import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    }

    const { amount, description, referenceId, referenceType } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // amount is in THB (whole number), Stripe expects satang (x100 for THB)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "thb",
      description: description ?? "NinjaGym payment",
      automatic_payment_methods: { enabled: true },
      metadata: {
        ...(referenceId ? { referenceId: String(referenceId) } : {}),
        ...(referenceType ? { referenceType: String(referenceType) } : {}),
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: unknown) {
    console.error("Stripe create-intent error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

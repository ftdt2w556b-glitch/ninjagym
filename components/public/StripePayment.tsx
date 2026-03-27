"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface CheckoutFormProps {
  onSuccess: () => void;
  onError: (msg: string) => void;
}

function CheckoutForm({ onSuccess, onError }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      onError(error.message ?? "Payment failed");
    } else {
      onSuccess();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full bg-[#1a56db] text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50"
      >
        {loading ? "Processing..." : "Pay with Card"}
      </button>
    </form>
  );
}

interface StripePaymentProps {
  amount: number;
  description: string;
  referenceId?: string | number;
  referenceType?: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export default function StripePayment({ amount, description, referenceId, referenceType, onSuccess, onError }: StripePaymentProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    if (!stripePromise || !amount) return;

    fetch("/api/stripe/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, description, referenceId, referenceType }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.clientSecret) setClientSecret(data.clientSecret);
        else setFetchError(data.error ?? "Failed to initialize payment");
      })
      .catch(() => setFetchError("Network error"));
  }, [amount, description]);

  if (!stripePromise) {
    return (
      <p className="text-gray-400 text-sm text-center py-4">
        Card payments not configured.
      </p>
    );
  }

  if (fetchError) {
    return <p className="text-red-400 text-sm text-center py-4">{fetchError}</p>;
  }

  if (!clientSecret) {
    return <p className="text-gray-400 text-sm text-center py-4 animate-pulse">Loading payment form...</p>;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm onSuccess={onSuccess} onError={onError} />
    </Elements>
  );
}

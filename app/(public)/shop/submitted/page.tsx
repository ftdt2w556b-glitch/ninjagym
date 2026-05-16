"use client";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useLanguage } from "@/lib/i18n/useLanguage";

function ShopSubmittedInner() {
  const { t } = useLanguage();
  // Carried over by /shop on submit so the right confirmation copy renders.
  // 'cash' → "Pay at the centre"; 'promptpay' → "Upload your slip"; anything
  // else (or missing) → the generic success message only.
  const pm = useSearchParams()?.get("pm") ?? "";

  const isCash      = pm === "cash";
  const isPromptpay = pm === "promptpay";

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-4 py-10 text-white text-center">
      <div className="mb-5">
        <Image src="/images/logo_small.png" alt="NinjaGym" width={120} height={120} className="drop-shadow-xl" />
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mb-6">
        <h1 className="font-fredoka text-2xl text-[#1a56db] mb-2">{t.successTitle}</h1>
        <p className="text-gray-600 text-sm mb-5">
          {t.successMsg}
        </p>

        {isCash ? (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-left mb-6">
            <p className="text-xs font-bold text-green-800 mb-1">💵 {t.payAtCentreTitle}</p>
            <p className="text-xs text-green-700 leading-relaxed">
              {t.payAtCentreNote}
            </p>
          </div>
        ) : isPromptpay ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-left mb-6">
            <p className="text-xs font-bold text-yellow-800 mb-1">{t.paymentPending}</p>
            <p className="text-xs text-yellow-700 leading-relaxed">
              {t.slipInstructions}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="bg-[#1a56db] text-white font-bold rounded-2xl py-3 text-center hover:bg-blue-700 transition-colors"
          >
            {t.backHome}
          </Link>
          <Link
            href="/shop"
            className="bg-gray-100 text-gray-700 font-semibold rounded-2xl py-3 text-center hover:bg-gray-200 transition-colors"
          >
            {t.orderMore}
          </Link>
        </div>
      </div>

      <p className="text-white/50 text-xs">Questions? Visit us at Big C Bophut, Koh Samui</p>
    </div>
  );
}

export default function ShopSubmittedPage() {
  // useSearchParams must be wrapped in Suspense for static prerendering.
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <ShopSubmittedInner />
    </Suspense>
  );
}

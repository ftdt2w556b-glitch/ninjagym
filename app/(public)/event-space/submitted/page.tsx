"use client";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/useLanguage";

export default function EventSpaceSubmittedPage() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-4 py-10 text-white text-center">
      <div className="mb-5">
        <Image src="/images/logo_small.png" alt="NinjaGym" width={120} height={120} className="drop-shadow-xl" />
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mb-6">
        <div className="text-6xl mb-4">🥷</div>
        <h1 className="font-fredoka text-2xl text-[#1a56db] mb-2">{t.successTitle}</h1>
        <p className="text-gray-600 text-sm mb-5">
          {t.successMsg}
        </p>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-left mb-6">
          <p className="text-xs font-bold text-yellow-800 mb-1">{t.paymentPending}</p>
          <p className="text-xs text-yellow-700 leading-relaxed">
            {t.slipInstructions}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="bg-[#1a56db] text-white font-bold rounded-2xl py-3 text-center hover:bg-blue-700 transition-colors"
          >
            {t.backHome}
          </Link>
          <Link
            href="/event-space"
            className="bg-gray-100 text-gray-700 font-semibold rounded-2xl py-3 text-center hover:bg-gray-200 transition-colors"
          >
            {t.bookAnotherDay}
          </Link>
        </div>
      </div>

      <p className="text-white/50 text-xs">Questions? Visit us at Big C Bophut, Koh Samui</p>
    </div>
  );
}

import Link from "next/link";
import Image from "next/image";

export default function BirthdaySubmittedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-4 py-10 text-white text-center">
      <div className="mb-5">
        <Image src="/images/logo_small.png" alt="NinjaGym" width={120} height={120} className="drop-shadow-xl" />
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mb-6">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="font-fredoka text-2xl text-[#1a56db] mb-2">Booking Received!</h1>
        <p className="text-gray-600 text-sm mb-5">
          Your birthday event booking is in. Staff will review your payment and confirm your date shortly.
        </p>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-left mb-6">
          <p className="text-xs font-bold text-yellow-800 mb-1">⏳ Payment Pending</p>
          <p className="text-xs text-yellow-700 leading-relaxed">
            If you paid by PromptPay, your slip is under review. If paying by cash, please pay cash now. Staff will confirm via email once approved.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="bg-[#1a56db] text-white font-bold rounded-2xl py-3 text-center hover:bg-blue-700 transition-colors"
          >
            Back to Home
          </Link>
          <Link
            href="/birthdays"
            className="bg-gray-100 text-gray-700 font-semibold rounded-2xl py-3 text-center hover:bg-gray-200 transition-colors"
          >
            Make Another Booking
          </Link>
        </div>
      </div>

      <p className="text-white/50 text-xs">Questions? Visit us at Big C Bophut, Koh Samui</p>
    </div>
  );
}

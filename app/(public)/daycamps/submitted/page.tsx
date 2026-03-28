import Link from "next/link";
import Image from "next/image";

export default function DayCampSubmittedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-4 py-10 text-white text-center">
      <div className="mb-4">
        <Image src="/images/logo_small.png" alt="NinjaGym" width={80} height={80} className="drop-shadow-xl" />
      </div>
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mb-6">
        <div className="text-5xl mb-4">🥷</div>
        <h1 className="font-fredoka text-2xl text-[#1a56db] mb-2">Camp Booked!</h1>
        <p className="text-gray-600 text-sm mb-4">
          Your Ninja Day Camp booking has been received. Staff will confirm your payment and send details shortly.
        </p>
        <div className="bg-blue-50 rounded-xl px-4 py-3 text-left mb-6">
          <p className="text-xs font-bold text-[#1a56db] mb-1">📍 Remember</p>
          <p className="text-xs text-gray-600">Drop in before 3pm · Big C Bophut, ground floor · Opens 9:30am (8am with advance notice)</p>
        </div>
        <div className="flex flex-col gap-3">
          <Link href="/" className="bg-[#1a56db] text-white font-bold rounded-2xl py-3 text-center hover:bg-blue-700 transition-colors">
            Back to Home
          </Link>
          <Link href="/daycamps" className="bg-gray-100 text-gray-700 font-semibold rounded-2xl py-3 text-center hover:bg-gray-200 transition-colors">
            Book Another Day
          </Link>
        </div>
      </div>
    </div>
  );
}

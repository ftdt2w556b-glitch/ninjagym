import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-dvh px-4 py-10 text-white">
      <h1 className="font-fredoka text-5xl mb-2 text-center drop-shadow-lg">
        NinjaGym
      </h1>
      <p className="font-bangers text-xl tracking-widest text-[#ffe033] mb-10 text-center">
        Rick Tew&apos;s Dojo - Koh Samui
      </p>

      <div className="flex flex-col gap-4 w-full">
        <Link
          href="/join"
          className="bg-[#22c55e] text-white font-bold text-lg rounded-2xl py-4 text-center shadow-lg hover:bg-green-500 transition-colors"
        >
          Join NinjaGym
        </Link>
        <Link
          href="/birthdays"
          className="bg-white text-[#1a56db] font-bold text-lg rounded-2xl py-4 text-center shadow-lg hover:bg-gray-50 transition-colors"
        >
          Birthday and Event Booking
        </Link>
        <Link
          href="/shop"
          className="bg-[#ffe033] text-[#1a56db] font-bold text-lg rounded-2xl py-4 text-center shadow-lg hover:bg-yellow-300 transition-colors"
        >
          Shop
        </Link>
        <Link
          href="/promptpay"
          className="bg-white/20 text-white font-semibold text-base rounded-2xl py-3 text-center hover:bg-white/30 transition-colors"
        >
          PromptPay Instructions
        </Link>
      </div>

      <div className="mt-10">
        <Link
          href="/admin/dashboard"
          className="text-white/60 text-sm underline"
        >
          Staff Login
        </Link>
      </div>
    </main>
  );
}

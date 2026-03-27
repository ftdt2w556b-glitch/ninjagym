import Link from "next/link";

export default function ShopSubmittedPage() {
  return (
    <div className="px-4 py-10 flex flex-col items-center justify-center min-h-dvh text-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="font-fredoka text-2xl text-[#1a56db] mb-2">Order Received!</h1>
        <p className="text-gray-600 text-sm mb-6">
          Your order has been submitted. Staff will prepare it and confirm your payment shortly.
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/" className="bg-[#1a56db] text-white font-bold rounded-2xl py-3 text-center hover:bg-blue-700 transition-colors">
            Back to Home
          </Link>
          <Link href="/shop" className="bg-gray-100 text-gray-700 font-semibold rounded-2xl py-3 text-center hover:bg-gray-200 transition-colors">
            Order More
          </Link>
        </div>
      </div>
    </div>
  );
}

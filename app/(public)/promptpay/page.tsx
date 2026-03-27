import Link from "next/link";

export default function PromptPayPage() {
  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <Link href="/" className="text-white/70 text-sm hover:text-white">← Back</Link>
      </div>

      <h1 className="font-fredoka text-3xl text-white drop-shadow mb-2">PromptPay Payment</h1>
      <p className="text-white/80 text-sm mb-6">How to pay with PromptPay</p>

      <div className="flex flex-col gap-4">

        <div className="bg-white rounded-2xl p-5 shadow">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-[#1a56db] text-white font-bangers text-lg w-8 h-8 rounded-full flex items-center justify-center">1</span>
            <h2 className="font-bold text-gray-800">Open your banking app</h2>
          </div>
          <p className="text-sm text-gray-600">Open any Thai banking app: KBank, SCB, Bangkok Bank, Krungthai, or any app with PromptPay.</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-[#1a56db] text-white font-bangers text-lg w-8 h-8 rounded-full flex items-center justify-center">2</span>
            <h2 className="font-bold text-gray-800">Transfer to PromptPay</h2>
          </div>
          <p className="text-sm text-gray-600 mb-3">Send the exact amount to:</p>
          <div className="bg-blue-50 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-gray-500 mb-1">PromptPay Number</p>
            <p className="font-fredoka text-2xl text-[#1a56db] tracking-widest">0862944374</p>
            <p className="text-sm text-gray-600 mt-1">Rick Tew Co., Ltd.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-[#1a56db] text-white font-bangers text-lg w-8 h-8 rounded-full flex items-center justify-center">3</span>
            <h2 className="font-bold text-gray-800">Take a screenshot</h2>
          </div>
          <p className="text-sm text-gray-600">Screenshot the transfer confirmation screen showing the amount, recipient name, and transaction reference.</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-[#1a56db] text-white font-bangers text-lg w-8 h-8 rounded-full flex items-center justify-center">4</span>
            <h2 className="font-bold text-gray-800">Upload your slip</h2>
          </div>
          <p className="text-sm text-gray-600">Go back to your registration or booking form and upload the screenshot. Staff will approve it within minutes.</p>
        </div>

        <div className="bg-[#ffe033] rounded-2xl p-4 shadow">
          <p className="text-sm font-bold text-[#1a56db]">Questions?</p>
          <p className="text-sm text-[#1a56db]">Show this page to staff at the front desk and they will help you.</p>
        </div>

        <div className="flex flex-col gap-3 mt-2">
          <Link
            href="/join"
            className="bg-[#22c55e] text-white font-bold text-lg rounded-2xl py-4 text-center shadow hover:bg-green-500 transition-colors"
          >
            Register as Member
          </Link>
          <Link
            href="/"
            className="bg-white/20 text-white font-semibold text-base rounded-2xl py-3 text-center hover:bg-white/30 transition-colors"
          >
            Back to Home
          </Link>
        </div>

      </div>
    </div>
  );
}

import Link from "next/link";

export default function PosPage() {
  return (
    <div className="text-center py-20">
      <h1 className="text-2xl font-bold text-gray-900 mb-3">POS Counter</h1>
      <p className="text-gray-500 mb-8">Phase 4 — coming after core app is complete.</p>
      <div className="flex gap-4 justify-center">
        <Link href="/scanner" className="bg-[#1a56db] text-white font-bold px-6 py-3 rounded-2xl hover:bg-blue-700 transition-colors">
          QR Scanner
        </Link>
        <Link href="/admin/dashboard" className="bg-gray-100 text-gray-700 font-semibold px-6 py-3 rounded-2xl hover:bg-gray-200 transition-colors">
          Dashboard
        </Link>
      </div>
    </div>
  );
}

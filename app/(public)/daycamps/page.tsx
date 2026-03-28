"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { Lang } from "@/lib/i18n/translations";
import { formatTHB, getPriceForType } from "@/lib/pricing";

const CAMP_PRICE_PER_KID = getPriceForType("day_camp", 1); // 555 THB per kid

export default function DayCampsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    camp_date: "",
    num_kids: 1,
    kids_names: "",
    payment_method: "promptpay",
    notes: "",
  });
  const [slip, setSlip] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("ng_lang") as Lang | null;
    if (saved) setLang(saved);
  }, []);

  const total = form.num_kids * CAMP_PRICE_PER_KID;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, String(v)));
      body.append("amount_paid", String(total));
      if (slip && form.payment_method === "promptpay") body.append("slip", slip);

      const res = await fetch("/api/daycamps", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      router.push("/daycamps/submitted");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white/70 hover:text-white text-sm">← Back</Link>
          <Image src="/images/logo_small.png" alt="NinjaGym" width={36} height={36} />
        </div>
        <LanguageSwitcher current={lang} onChange={(l) => { setLang(l); localStorage.setItem("ng_lang", l); }} />
      </div>

      <h1 className="font-fredoka text-3xl text-white drop-shadow mb-1">Ninja Day Camp</h1>
      <p className="font-bangers text-base text-[#ffe033] tracking-widest mb-5">10AM TO 2PM, DROP-IN BEFORE 2PM</p>

      {/* What's included */}
      <div className="bg-[#1a56db] rounded-2xl p-4 shadow mb-5">
        <h2 className="font-bold text-white text-sm uppercase tracking-wide mb-3">What&apos;s Included</h2>
        <ul className="flex flex-col gap-1.5 text-sm text-white/90">
          {[
            "4-hour supervised ninja training session (10am to 2pm)",
            "Climbing, parkour, obstacle courses",
            "Jump & roll fundamentals",
            "Active Guides, not just supervisors",
            "Suitable for kids aged 3 and up",
            "Drop-in before 2pm",
          ].map(item => (
            <li key={item} className="flex items-start gap-2"><span>🥷</span><span>{item}</span></li>
          ))}
        </ul>
        <div className="mt-3 bg-white/20 rounded-xl px-4 py-2 text-center">
          <p className="text-white/70 text-xs">Price per child</p>
          <p className="font-fredoka text-2xl text-[#ffe033]">{formatTHB(CAMP_PRICE_PER_KID)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Parent details */}
        <div className="bg-white rounded-2xl p-4 shadow flex flex-col gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Parent / Guardian</h2>
          {[
            { name: "name", label: "Full Name *", type: "text", placeholder: "e.g. Sarah Johnson", required: true },
            { name: "phone", label: "Phone", type: "tel", placeholder: "+66 80 000 0000", required: false },
            { name: "email", label: "Email", type: "email", placeholder: "you@example.com", required: false },
          ].map(f => (
            <div key={f.name}>
              <label className="block text-sm font-bold text-gray-700 mb-1">{f.label}</label>
              <input
                type={f.type}
                required={f.required}
                value={form[f.name as keyof typeof form] as string}
                onChange={e => setForm({ ...form, [f.name]: e.target.value })}
                placeholder={f.placeholder}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              />
            </div>
          ))}
        </div>

        {/* Camp details */}
        <div className="bg-white rounded-2xl p-4 shadow flex flex-col gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Camp Details</h2>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Camp Date *</label>
            <input
              type="date"
              required
              value={form.camp_date}
              onChange={e => setForm({ ...form, camp_date: e.target.value })}
              min={new Date().toISOString().split("T")[0]}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Number of Kids</label>
            <select
              value={form.num_kids}
              onChange={e => setForm({ ...form, num_kids: Number(e.target.value) })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            >
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <option key={n} value={n}>{n} kid{n !== 1 ? "s" : ""} — {formatTHB(n * CAMP_PRICE_PER_KID)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Kids&apos; Names</label>
            <input
              type="text"
              value={form.kids_names}
              onChange={e => setForm({ ...form, kids_names: e.target.value })}
              placeholder="e.g. Tom, Lisa"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Allergies, special requirements..."
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            />
          </div>
        </div>

        {/* Total */}
        <div className="bg-[#ffe033] rounded-2xl px-4 py-3 flex items-center justify-between shadow">
          <span className="font-bangers text-lg text-[#1a56db] tracking-wide">TOTAL</span>
          <span className="font-fredoka text-2xl text-[#1a56db]">{formatTHB(total)}</span>
        </div>

        {/* Payment method */}
        <div className="bg-white rounded-2xl p-4 shadow">
          <label className="block text-sm font-bold text-gray-700 mb-2">Payment Method</label>
          <div className="flex flex-col gap-2">
            {[
              { value: "promptpay", label: "📱 PromptPay" },
              { value: "cash", label: "💵 Cash at the gym" },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-colors ${
                form.payment_method === opt.value ? "border-[#1a56db] bg-blue-50" : "border-gray-100"
              }`}>
                <input type="radio" name="payment_method" value={opt.value}
                  checked={form.payment_method === opt.value}
                  onChange={() => setForm({ ...form, payment_method: opt.value })}
                  className="accent-[#1a56db]" />
                <span className="text-sm font-medium">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Slip upload */}
        {form.payment_method === "promptpay" && (
          <div className="bg-white rounded-2xl p-4 shadow">
            <label className="block text-sm font-bold text-gray-700 mb-1">Upload Payment Slip</label>
            <p className="text-xs text-gray-500 mb-3">Screenshot of your PromptPay transfer confirmation</p>
            <input
              type="file"
              accept="image/*"
              onChange={e => setSlip(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#1a56db] file:text-white file:font-semibold"
            />
            {slip && <p className="text-xs text-green-600 mt-2">Selected: {slip.name}</p>}
          </div>
        )}

        {error && <div className="bg-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-[#22c55e] text-white font-bold text-lg rounded-2xl py-4 shadow-lg hover:bg-green-500 transition-colors disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Book Day Camp 🥷"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { translations, Lang } from "@/lib/i18n/translations";
import { MEMBERSHIP_TYPES, getPriceForType, formatTHB } from "@/lib/pricing";

const StripePayment = lazy(() => import("@/components/public/StripePayment"));

export default function JoinPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const t = translations[lang];

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    kids_names: "",
    kids_count: 1,
    membership_type: "session_group",
    payment_method: "promptpay",
    notes: "",
  });
  const [slip, setSlip] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Stripe two-step state
  const [stripeStep, setStripeStep] = useState(false);
  const [pendingMemberId, setPendingMemberId] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("ng_lang") as Lang | null;
    if (saved) setLang(saved);
  }, []);

  function handleLang(l: Lang) {
    setLang(l);
    localStorage.setItem("ng_lang", l);
  }

  const price = getPriceForType(form.membership_type, form.kids_count);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, String(v)));
      body.append("amount_paid", String(price));
      if (slip && form.payment_method === "promptpay") body.append("slip", slip);

      const res = await fetch("/api/members", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Submission failed");

      if (form.payment_method === "stripe") {
        setPendingMemberId(data.id);
        setStripeStep(true);
        setSubmitting(false);
      } else {
        router.push(`/qr/card/${data.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  // Stripe two-step payment screen
  if (stripeStep && pendingMemberId) {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setStripeStep(false)}
            className="text-white/70 hover:text-white text-2xl leading-none"
          >
            ←
          </button>
          <h1 className="font-fredoka text-3xl text-white drop-shadow">Card Payment</h1>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
            <span className="text-gray-600 text-sm">{form.name}</span>
            <span className="font-fredoka text-2xl text-[#1a56db]">{formatTHB(price)}</span>
          </div>
          <Suspense fallback={<p className="text-gray-400 text-sm text-center py-4 animate-pulse">Loading...</p>}>
            <StripePayment
              amount={price}
              description={`NinjaGym membership — ${form.membership_type}`}
              referenceId={pendingMemberId}
              referenceType="member"
              onSuccess={() => router.push(`/qr/card/${pendingMemberId}`)}
              onError={(msg) => setError(msg)}
            />
          </Suspense>
          {error && (
            <div className="bg-red-100 text-red-700 rounded-xl px-4 py-3 text-sm mt-3">{error}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white/70 hover:text-white text-sm">← Back</Link>
          <Image src="/images/logo_small.png" alt="NinjaGym" width={36} height={36} />
        </div>
        <LanguageSwitcher current={lang} onChange={handleLang} />
      </div>
      <h1 className="font-fredoka text-3xl text-white drop-shadow mb-1">{t.joinTitle}</h1>
      <p className="font-bangers text-base text-[#ffe033] tracking-widest mb-5">RICK TEW&apos;S DOJO — KOH SAMUI</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Name */}
        <div className="bg-white rounded-2xl p-4 shadow">
          <label className="block text-sm font-bold text-gray-700 mb-1">{t.nameLabel} *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            placeholder="e.g. Sarah Johnson"
          />
        </div>

        {/* Phone */}
        <div className="bg-white rounded-2xl p-4 shadow">
          <label className="block text-sm font-bold text-gray-700 mb-1">{t.phoneLabel}</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            placeholder="+66 80 000 0000"
          />
        </div>

        {/* Email */}
        <div className="bg-white rounded-2xl p-4 shadow">
          <label className="block text-sm font-bold text-gray-700 mb-1">{t.emailLabel}</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            placeholder="you@example.com"
          />
        </div>

        {/* Kids names + count */}
        <div className="bg-white rounded-2xl p-4 shadow flex flex-col gap-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.kidsNamesLabel}</label>
            <input
              type="text"
              value={form.kids_names}
              onChange={(e) => setForm({ ...form, kids_names: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder="e.g. Tom, Lisa"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.kidsCountLabel}</label>
            <select
              value={form.kids_count}
              onChange={(e) => setForm({ ...form, kids_count: Number(e.target.value) })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Membership type */}
        <div className="bg-white rounded-2xl p-4 shadow">
          <label className="block text-sm font-bold text-gray-700 mb-2">{t.membershipTypeLabel} *</label>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {MEMBERSHIP_TYPES.map((mt) => {
              const p = getPriceForType(mt.id, form.kids_count);
              return (
                <label
                  key={mt.id}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer border transition-colors ${
                    form.membership_type === mt.id
                      ? "border-[#1a56db] bg-blue-50"
                      : "border-gray-100 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="membership_type"
                      value={mt.id}
                      checked={form.membership_type === mt.id}
                      onChange={() => setForm({ ...form, membership_type: mt.id })}
                      className="accent-[#1a56db]"
                    />
                    <span className="text-sm font-medium text-gray-800">{mt.label}</span>
                    {mt.perKid && (
                      <span className="text-xs text-gray-400">per kid</span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-[#1a56db]">{formatTHB(p)}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Price summary */}
        <div className="bg-[#ffe033] rounded-2xl px-4 py-3 flex items-center justify-between shadow">
          <span className="font-bangers text-lg text-[#1a56db] tracking-wide">TOTAL</span>
          <span className="font-fredoka text-2xl text-[#1a56db]">{formatTHB(price)}</span>
        </div>

        {/* Payment method */}
        <div className="bg-white rounded-2xl p-4 shadow">
          <label className="block text-sm font-bold text-gray-700 mb-2">{t.paymentMethodLabel}</label>
          <div className="flex flex-col gap-2">
            <label className={`flex items-center gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-colors ${
              form.payment_method === "promptpay" ? "border-[#1a56db] bg-blue-50" : "border-gray-100"
            }`}>
              <input
                type="radio"
                name="payment_method"
                value="promptpay"
                checked={form.payment_method === "promptpay"}
                onChange={() => setForm({ ...form, payment_method: "promptpay" })}
                className="accent-[#1a56db]"
              />
              <span className="text-sm font-medium">📱 {t.promptpayOption}</span>
            </label>
            <label className={`flex items-center gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-colors ${
              form.payment_method === "cash" ? "border-[#1a56db] bg-blue-50" : "border-gray-100"
            }`}>
              <input
                type="radio"
                name="payment_method"
                value="cash"
                checked={form.payment_method === "cash"}
                onChange={() => setForm({ ...form, payment_method: "cash" })}
                className="accent-[#1a56db]"
              />
              <span className="text-sm font-medium">💵 {t.cashOption}</span>
            </label>
            <label className={`flex items-center gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-colors ${
              form.payment_method === "stripe" ? "border-[#1a56db] bg-blue-50" : "border-gray-100"
            }`}>
              <input
                type="radio"
                name="payment_method"
                value="stripe"
                checked={form.payment_method === "stripe"}
                onChange={() => setForm({ ...form, payment_method: "stripe" })}
                className="accent-[#1a56db]"
              />
              <span className="text-sm font-medium">💳 Credit / Debit Card</span>
            </label>
          </div>
        </div>

        {/* Slip upload (PromptPay only) */}
        {form.payment_method === "promptpay" && (
          <div className="bg-white rounded-2xl p-4 shadow">
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.uploadSlip}</label>
            <p className="text-xs text-gray-500 mb-3">{t.slipInstructions}</p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSlip(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#1a56db] file:text-white file:font-semibold"
            />
            {slip && (
              <p className="text-xs text-green-600 mt-2">Selected: {slip.name}</p>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="bg-[#22c55e] text-white font-bold text-lg rounded-2xl py-4 shadow-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? t.submitting
            : form.payment_method === "stripe"
            ? "Register & Pay by Card →"
            : t.submitBtn}
        </button>
      </form>
    </div>
  );
}

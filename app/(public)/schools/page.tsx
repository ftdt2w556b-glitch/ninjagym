"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { translations, Lang } from "@/lib/i18n/translations";
import { formatTHB } from "@/lib/pricing";

const SCHOOL_RATE = 2222;
const PHOTOGRAPHER_FEE = 1000;

const GAMING_ZONE_NOTE =
  "School sessions are shared access. NinjaGym remains open to other guests during your booking. The Gaming Zones are separate and not included.";

const TERMS = [
  "This offer is for official school groups only. Not for families, parents, or individual guests.",
  "All students must arrive and depart as a group. No separate guests or outside participants.",
  "Sessions are shared access. Other kids may be present during your booking.",
  "Available weekdays before 2pm only. No weekend or holiday bookings under this rate.",
  "Maximum 22 students. No additional kids beyond the group limit.",
  "Arrival and departure must occur within your 2-hour booked session.",
  "No refunds. We reserve your date on payment.",
  "Pay in advance to confirm your booking.",
];

export default function EventSpacePage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const t = translations[lang];

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    event_date: "",
    time_slot: "morning" as const,
    hours: "",
    num_hours: 2,
    num_kids: 10,
    payment_method: "cash",
    notes: "",
    photographer_requested: false,
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [slip, setSlip] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [cashStaffName, setCashStaffName] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("ng_lang") as Lang | null;
    if (saved) setLang(saved);
  }, []);

  function handleLang(l: Lang) {
    setLang(l);
    localStorage.setItem("ng_lang", l);
  }

  const total = SCHOOL_RATE + (form.photographer_requested ? PHOTOGRAPHER_FEE : 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!termsAccepted) {
      setError("Please read and accept the Terms before submitting.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, String(v)));
      body.append("amount_paid", String(total));
      body.append("booking_type", "event_space");
      if (form.payment_method === "cash" && cashStaffName) {
        const staffNote = form.notes ? `${form.notes} | Staff: ${cashStaffName}` : `Staff: ${cashStaffName}`;
        body.set("notes", staffNote);
      }
      if (slip) body.append("slip", slip);

      const res = await fetch("/api/event-bookings", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError("That date is already booked. Please choose a different date.");
        } else {
          throw new Error(data.error || "Submission failed");
        }
        setSubmitting(false);
        return;
      }

      router.push(`/schools/submitted`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-white/70 hover:text-white text-sm">← Back</Link>
        <LanguageSwitcher current={lang} onChange={handleLang} />
      </div>

      {/* Floating hero image */}
      <div className="flex justify-center py-4 mb-2">
        <div style={{ animation: "floatSpace 3s ease-in-out infinite" }}>
          <Image
            src="/images/App3_small.png"
            alt="NinjaGym School Outing"
            width={180}
            height={180}
            className="drop-shadow-2xl rounded-3xl"
            priority
          />
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="font-bangers text-5xl text-white tracking-widest drop-shadow-lg mb-1">
          SCHOOL OUTING
        </h1>
        <p className="text-white/80 text-sm mb-3">🎓 NinjaGym School Discount Program</p>
        <span className="inline-block bg-white/20 text-white text-xs font-semibold px-4 py-1.5 rounded-full">
          📍 Big C, Bophut, Koh Samui
        </span>
      </div>

      {/* The 2222 Special */}
      <div className="bg-white rounded-2xl p-5 shadow mb-4">
        <p className="text-xs font-bold text-[#1a56db] uppercase tracking-widest mb-1">The Rick Tew 2222 Special</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Perfect for school outings, activity days, or a reward for hard-working students. NinjaGym makes fitness fun, social, and affordable.
        </p>

        <div className="bg-[#1a56db] rounded-xl px-4 py-3 mb-4 text-center">
          <p className="text-white/80 text-xs font-semibold mb-1">Flat rate for school groups</p>
          <p className="font-fredoka text-4xl text-[#ffe033] tracking-wide">2,222 THB</p>
        </div>

        <ul className="flex flex-col gap-2 text-sm text-gray-700 mb-4">
          {[
            "Up to 22 students",
            "2 hours of NinjaGym fun",
            "Available before 2pm (weekdays only)",
            "For official school groups only",
            "Shared access: other kids may be present",
            "No guests, parents, or outside participants",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-[#1a56db] font-bold shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="bg-blue-50 rounded-xl px-4 py-2.5 text-center">
          <p className="text-sm font-bold text-[#1a56db]">👉 22 students · 2 hours · before 2pm · 2,222 THB</p>
        </div>
      </div>

      {/* Shared access note */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 shadow mb-4">
        <p className="text-xs text-yellow-800 leading-relaxed">
          ⚠️ <strong>Please note:</strong> {GAMING_ZONE_NOTE}
        </p>
      </div>

      {/* TERMS */}
      <div className="bg-[#2a1f3d] border-2 border-orange-500/40 rounded-2xl p-5 shadow mb-5">
        <h2 className="font-bangers text-orange-400 text-lg tracking-widest mb-4">📋 TERMS</h2>
        <ol className="flex flex-col gap-0">
          {TERMS.map((term, i) => (
            <li key={i} className="flex items-start gap-3 py-2.5 border-b border-white/10 last:border-0">
              <span className="shrink-0 w-6 h-6 rounded-full bg-orange-500/80 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-white/85 leading-relaxed">{term}</span>
            </li>
          ))}
        </ol>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* School details */}
        <div className="bg-white rounded-2xl p-5 shadow flex flex-col gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">School Details</h2>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">School Name &amp; Manager Name *</label>
            <input type="text" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder="e.g. Samui International School, Ms. Nong" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.phoneLabel}</label>
            <input type="tel" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder="+66 80 000 0000" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.emailLabel}</label>
            <input type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder="school@example.com" />
          </div>
        </div>

        {/* Booking details */}
        <div className="bg-white rounded-2xl p-5 shadow flex flex-col gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Booking Details</h2>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.eventDate} *</label>
            <input type="date" required value={form.event_date}
              onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              min={new Date().toISOString().split("T")[0]} />
            <p className="text-xs text-gray-400 mt-1">Weekdays only. Sessions must start and finish before 2pm.</p>
          </div>

          {/* Fixed time slot display */}
          <div className="bg-blue-50 border border-[#1a56db]/20 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">Time Slot</p>
            <p className="text-sm font-bold text-[#1a56db]">Before 2pm, Weekdays Only</p>
            <p className="text-xs text-gray-500 mt-0.5">Your 2-hour session must conclude by 2:00pm.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Preferred Start Time *</label>
            <input type="text" required value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder="e.g. 10:00am – 12:00pm" />
            <p className="text-xs text-gray-400 mt-1">2-hour session. Must end by 2:00pm.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Number of Students *</label>
            <input type="number" required min="1" max="22" value={form.num_kids}
              onChange={(e) => setForm({ ...form, num_kids: Math.min(22, Number(e.target.value)) })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]" />
            <p className="text-xs text-gray-400 mt-1">Up to 22 students. Flat rate of 2,222 THB regardless of group size.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] resize-none"
              placeholder="Grade level, any special requirements, or details for staff..." />
          </div>
        </div>

        {/* Photographer upgrade */}
        <div className={`rounded-2xl p-4 shadow border-2 transition-colors ${
          form.photographer_requested ? "bg-blue-50 border-[#1a56db]" : "bg-white border-gray-100"
        }`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.photographer_requested}
              onChange={(e) => setForm({ ...form, photographer_requested: e.target.checked })}
              className="mt-1 accent-[#1a56db] w-5 h-5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-gray-800">📸 Add Photos</p>
                <span className="font-bold text-[#1a56db] text-base">+1,000 THB</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Staff will capture shots of your group session. Digital images delivered to your school contact within a few days.
              </p>
            </div>
          </label>
        </div>

        {/* Total */}
        <div className="bg-[#ffe033] rounded-2xl px-5 py-4 shadow">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-800 text-base">TOTAL</span>
            <span className="font-bold text-gray-900 text-2xl">{formatTHB(total)}</span>
          </div>
          <p className="text-sm text-gray-700 mt-1">
            2,222 THB flat rate · up to 22 students · 2 hours
            {form.photographer_requested ? " + photos (1,000 THB)" : ""}
          </p>
        </div>

        {/* Payment method */}
        <div className="bg-white rounded-2xl p-5 shadow">
          <label className="block text-sm font-bold text-gray-700 mb-3">{t.paymentMethodLabel}</label>
          <div className="flex flex-col gap-2">
            {/* Cash — green */}
            <div className={`rounded-xl border-2 transition-colors ${
              form.payment_method === "cash" ? "border-green-500 bg-green-100" : "border-green-200 bg-green-50"
            }`}>
              <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                <input type="radio" name="payment_method" value="cash"
                  checked={form.payment_method === "cash"}
                  onChange={() => setForm({ ...form, payment_method: "cash" })}
                  className="accent-green-500" />
                <span className="text-sm font-semibold text-green-700">💵 {t.cashOption}</span>
              </label>
              {form.payment_method === "cash" && (
                <div className="px-4 pb-3" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-semibold text-green-700 mb-1">Staff Name <span className="font-normal">(who received the cash)</span></p>
                  <input type="text" value={cashStaffName} onChange={(e) => setCashStaffName(e.target.value)}
                    className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" />
                </div>
              )}
            </div>
            {/* PromptPay — blue */}
            <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
              form.payment_method === "promptpay" ? "border-[#1a56db] bg-blue-100" : "border-blue-200 bg-blue-50"
            }`}>
              <input type="radio" name="payment_method" value="promptpay"
                checked={form.payment_method === "promptpay"}
                onChange={() => setForm({ ...form, payment_method: "promptpay" })}
                className="accent-[#1a56db]" />
              <span className="text-sm font-semibold text-[#1a56db]">📱 {t.promptpayOption}</span>
            </label>
            {/* Credit card — re-enable when needed */}
            {/* { value: "stripe", label: "💳 Credit / Debit Card" } */}
          </div>
          {form.payment_method === "stripe" && (
            <p className="text-xs text-gray-400 mt-2">
              Card payment will be arranged by staff upon confirmation of your booking.
            </p>
          )}
        </div>

        {/* PromptPay panel */}
        {form.payment_method === "promptpay" && (
          <div className="bg-white rounded-2xl p-5 shadow flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2">
              <Image src="/images/promptpay-qr-small.png" alt="PromptPay QR" width={160} height={160} className="rounded-xl" />
              <div className="text-center">
                <p className="text-sm font-bold text-gray-800">PromptPay: 086-294-4374</p>
                <p className="text-xs text-gray-500">Bangkok Bank: 451-7-17573-5</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 text-center w-full">
                <p className="text-xs text-gray-500 mb-0.5">Transfer exactly</p>
                <p className="text-2xl font-bold text-[#1a56db]">{formatTHB(total)}</p>
              </div>
            </div>

            <ol className="flex flex-col gap-2 text-xs text-gray-600">
              {[
                "Open your banking app",
                `Transfer exactly ${formatTHB(total)} to the number above`,
                "Take a screenshot of the confirmation",
                "Upload your slip below",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#1a56db] text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t.uploadSlip}</label>
              <input type="file" accept="image/*"
                onChange={(e) => setSlip(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#1a56db] file:text-white file:font-semibold" />
              {slip && <p className="text-xs text-green-600 mt-2">✓ {slip.name}</p>}
            </div>
          </div>
        )}

        {/* Terms acceptance */}
        <div className={`rounded-2xl p-4 border-2 transition-colors ${
          termsAccepted ? "bg-green-50 border-green-400" : "bg-white border-orange-300"
        }`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 accent-green-600 w-5 h-5 shrink-0"
            />
            <p className="text-sm text-gray-700 leading-relaxed">
              I confirm this is an <strong>official school group booking</strong> and I have read and agree to the <strong>Terms</strong> above, including the no-guests policy and shared-access conditions.
            </p>
          </label>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        <button type="submit" disabled={submitting || !termsAccepted}
          className="bg-[#22c55e] text-white font-bold text-lg rounded-2xl py-4 shadow-lg hover:bg-green-500 transition-colors disabled:opacity-50">
          {submitting ? t.submitting : "Book School Outing →"}
        </button>

        {!termsAccepted && (
          <p className="text-center text-xs text-white/60">Please accept the terms above to continue</p>
        )}
      </form>

      <style jsx global>{`
        @keyframes floatSpace {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { translations, Lang } from "@/lib/i18n/translations";
import { getBirthdayAmount, formatTHB, BirthdayTimeSlot } from "@/lib/pricing";

const GAMING_ZONE_NOTE =
  "Booking an Event at NinjaGym is only for the Main Activity Zones and does not include the Gaming Zones. Although your event is private for you only, we keep the game rooms open for other guests at all hours.";

const TIME_SLOTS: { id: BirthdayTimeSlot; label: string; rate: number; note: string }[] = [
  { id: "morning",   label: "Morning / Off-Peak",  rate: 3000, note: "9:00am – 3:30pm (weekdays)" },
  { id: "afternoon", label: "Afternoon / Peak",     rate: 5000, note: "3:30pm – 6:30pm (weekdays)" },
  { id: "evening",   label: "Evening / Off-Peak",   rate: 3000, note: "6:30pm – 9:30pm (weekdays)" },
  { id: "weekend",   label: "Weekend (after 2pm)",  rate: 5000, note: "After 2:00pm (Sat / Sun)" },
];

const TERMS = [
  "Arrival, setup, and departure must all occur within your booked time. Staff begins setup at your start time.",
  "Please instruct guests to arrive 15–20 minutes after your start time so setup is complete.",
  "Overtime is charged at 500 THB per 10-minute period if you exceed your reserved end time.",
  "No refunds. We reserve your date on payment.",
  "Pay in advance to confirm your booking.",
  "Regular NinjaGym policies apply for all events.",
];

const HOUR_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4];
const PHOTOGRAPHER_FEE = 1000;

export default function EventSpacePage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const t = translations[lang];

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    event_date: "",
    time_slot: "afternoon" as BirthdayTimeSlot,
    hours: "",
    num_hours: 2,
    num_kids: 5,
    payment_method: "cash",
    notes: "",
    photographer_requested: false,
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [slip, setSlip] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("ng_lang") as Lang | null;
    if (saved) setLang(saved);
  }, []);

  function handleLang(l: Lang) {
    setLang(l);
    localStorage.setItem("ng_lang", l);
  }

  const baseTotal = getBirthdayAmount(form.time_slot, form.num_hours, form.num_kids);
  const total = baseTotal + (form.photographer_requested ? PHOTOGRAPHER_FEE : 0);
  const selectedSlot = TIME_SLOTS.find((s) => s.id === form.time_slot)!;

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
      if (slip) body.append("slip", slip);

      const res = await fetch("/api/event-bookings", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError("That date and time slot is already booked. Please choose a different slot.");
        } else {
          throw new Error(data.error || "Submission failed");
        }
        setSubmitting(false);
        return;
      }

      router.push(`/event-space/submitted`);
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
            alt="NinjaGym Event Space"
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
          BOOK AN EVENT
        </h1>
        <p className="text-white/80 text-sm mb-3">Reserve the NinjaGym for your private event</p>
        <span className="inline-block bg-white/20 text-white text-xs font-semibold px-4 py-1.5 rounded-full">
          📍 Big C, Bophut, Koh Samui
        </span>
      </div>

      {/* What's included */}
      <div className="bg-[#1a3a6e] border border-white/10 rounded-2xl p-5 shadow mb-4">
        <h2 className="font-bangers text-yellow-300 text-lg tracking-widest mb-3">🥷 WHAT IS INCLUDED</h2>
        <ul className="flex flex-col gap-2 text-sm text-white/90">
          {[
            "1 guided 50-minute training session",
            "Staff assistance throughout",
            "Access to training, climbing & ninja zones",
            "Cleanup service included",
            "5 kids free with every event",
            "Private use of all Main Activity Zones",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="shrink-0">🥷</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Gaming zone notice */}
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

        {/* Your details */}
        <div className="bg-white rounded-2xl p-5 shadow flex flex-col gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Your Details</h2>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.nameLabel} *</label>
            <input type="text" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder="Your name" />
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
              placeholder="you@example.com" />
          </div>
        </div>

        {/* Event details */}
        <div className="bg-white rounded-2xl p-5 shadow flex flex-col gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Event Details</h2>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.eventDate} *</label>
            <input type="date" required value={form.event_date}
              onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              min={new Date().toISOString().split("T")[0]} />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{t.timeSlot} *</label>
            <div className="grid grid-cols-2 gap-2">
              {TIME_SLOTS.map((slot) => (
                <label key={slot.id} className={`flex flex-col px-3 py-3 rounded-xl border cursor-pointer transition-colors ${
                  form.time_slot === slot.id ? "border-[#1a56db] bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                }`}>
                  <input type="radio" name="time_slot" value={slot.id}
                    checked={form.time_slot === slot.id}
                    onChange={() => setForm({ ...form, time_slot: slot.id })}
                    className="sr-only" />
                  <span className="text-sm font-bold text-gray-800">{slot.label}</span>
                  <span className="text-xs text-gray-500 mt-0.5">{slot.note}</span>
                  <span className="text-sm font-bold text-[#1a56db] mt-1">{slot.rate.toLocaleString()} THB/hr</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Start &amp; End Time *</label>
            <input type="text" required value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder="e.g. 2:00pm – 4:00pm" />
            <p className="text-xs text-gray-400 mt-1">Required — this reserves your exact time slot.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.numHours} *</label>
            <select value={form.num_hours}
              onChange={(e) => setForm({ ...form, num_hours: Number(e.target.value) })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]">
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>{h} {h === 1 ? "hour" : "hours"}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.numKids} *</label>
            <input type="number" required min="1" max="20" value={form.num_kids}
              onChange={(e) => setForm({ ...form, num_kids: Number(e.target.value) })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]" />
            <p className="text-xs text-gray-400 mt-1">First 5 kids included · 6–10 +500 THB · 11–15 +1,000 THB · 16–20 +1,500 THB</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] resize-none"
              placeholder="Any special requests, theme, or details for staff..." />
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
                <p className="font-bold text-gray-800">📸 Want Photos Too?</p>
                <span className="font-bold text-[#1a56db] text-base">+1,000 THB</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Staff will capture periodic shots of your event. Digital images will be delivered to your member page within a few days. Higher res may be available upon request to your USB drive.
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
            {selectedSlot.rate.toLocaleString()} THB/hr × {form.num_hours} hr{form.num_hours !== 1 ? "s" : ""}
            {form.num_kids > 5 ? " + extra kids" : " (first 5 included)"}
            {form.photographer_requested ? " + photos (1,000 THB)" : ""}
          </p>
        </div>

        {/* Payment method */}
        <div className="bg-white rounded-2xl p-5 shadow">
          <label className="block text-sm font-bold text-gray-700 mb-3">{t.paymentMethodLabel}</label>
          <div className="flex flex-col gap-2">
            {[
              { value: "cash",      label: `💵 ${t.cashOption}` },
              { value: "promptpay", label: `📱 ${t.promptpayOption}` },
            ].map((opt) => (
              <label key={opt.value} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                form.payment_method === opt.value ? "border-[#1a56db] bg-blue-50" : "border-gray-200"
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
              I have read and agree to the <strong>Terms</strong> above, including that{" "}
              <strong>setup, event, and departure must occur within my booked time</strong>, and that{" "}
              <strong>overtime is charged at 500 THB per 10-minute period</strong>.
            </p>
          </label>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        <button type="submit" disabled={submitting || !termsAccepted}
          className="bg-[#22c55e] text-white font-bold text-lg rounded-2xl py-4 shadow-lg hover:bg-green-500 transition-colors disabled:opacity-50">
          {submitting ? t.submitting : t.bookBtn}
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

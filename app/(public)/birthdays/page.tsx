"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { translations, Lang } from "@/lib/i18n/translations";
import { getBirthdayAmount, formatTHB, BirthdayTimeSlot } from "@/lib/pricing";

const StripePayment = lazy(() => import("@/components/public/StripePayment"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const HOUR_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4];
const PHOTOGRAPHER_FEE = 1000;

export default function BirthdaysPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const t = translations[lang];

  const TIME_SLOTS: { id: BirthdayTimeSlot; label: string; rate: number; note: string }[] = [
    { id: "morning",   label: t.slotMorningLabel,   rate: 3000, note: t.slotMorningNote },
    { id: "afternoon", label: t.slotAfternoonLabel, rate: 5000, note: t.slotAfternoonNote },
    { id: "evening",   label: t.slotEveningLabel,   rate: 3000, note: t.slotEveningNote },
    { id: "weekend",   label: t.slotWeekendLabel,   rate: 5000, note: t.slotWeekendNote },
  ];

  const TERMS = [
    t.birthdayTerm1,
    t.birthdayTerm2,
    t.birthdayTerm3,
    t.birthdayTerm4,
    t.birthdayTerm5,
  ];

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    event_date: "",
    time_slot: "afternoon" as BirthdayTimeSlot,
    hours: "",
    num_hours: 2,
    num_kids: 5,
    birthday_child_name: "",
    birthday_child_age: "",
    payment_method: "cash",
    notes: "",
    photographer_requested: false,
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [slip, setSlip] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [stripeStep, setStripeStep] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState<number | null>(null);

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

      if (form.payment_method === "stripe") {
        setPendingBookingId(data.id);
        setStripeStep(true);
        setSubmitting(false);
        return;
      }

      router.push(`/birthdays/submitted`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  if (stripeStep && pendingBookingId) {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setStripeStep(false)} className="text-white/70 hover:text-white text-2xl leading-none">←</button>
          <h1 className="font-bangers text-3xl text-white tracking-widest drop-shadow">Card Payment</h1>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
            <span className="text-gray-600 text-sm">Birthday / Event booking</span>
            <span className="font-fredoka text-2xl text-[#1a56db]">{formatTHB(total)}</span>
          </div>
          <Suspense fallback={<p className="text-gray-400 text-sm text-center py-4 animate-pulse">Loading...</p>}>
            <StripePayment
              amount={total}
              description="NinjaGym birthday/event booking"
              referenceId={pendingBookingId}
              referenceType="event"
              onSuccess={() => router.push("/birthdays/submitted")}
              onError={(msg) => setError(msg)}
            />
          </Suspense>
          {error && <div className="bg-red-100 text-red-700 rounded-xl px-4 py-3 text-sm mt-3">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-white/70 hover:text-white text-sm">← Back</Link>
        <LanguageSwitcher current={lang} onChange={handleLang} />
      </div>

      {/* Floating hero image (same as home page style) */}
      <div className="flex justify-center py-4 mb-2">
        <div style={{ animation: "floatCake 3s ease-in-out infinite" }}>
          <Image
            src="/images/App4_small.png"
            alt="Birthday party at NinjaGym"
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
          BIRTHDAYS &amp; EVENTS
        </h1>
        <a
          href="https://maps.app.goo.gl/eAfNRktaPpr9uhYi9"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-white/20 text-white text-xs font-semibold px-4 py-1.5 rounded-full hover:bg-white/30 transition-colors"
        >
          📍 At Rick Tew&apos;s NinjaGym Big C Mall, in Bophut
        </a>
      </div>

      {/* What's included */}
      <div className="bg-[#1a3a6e] border border-white/10 rounded-2xl p-5 shadow mb-4">
        <h2 className="font-bangers text-yellow-300 text-lg tracking-widest mb-3">{t.birthdayWhatsIncluded}</h2>
        <ul className="flex flex-col gap-2 text-sm text-white/90">
          {[
            t.birthdayIncluded1,
            t.birthdayIncluded2,
            t.birthdayIncluded3,
            t.birthdayIncluded4,
            t.birthdayIncluded5,
            t.birthdayIncluded6,
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
          ⚠️ <strong>Note:</strong> {t.birthdayGamingNote}
        </p>
      </div>

      {/* TERMS */}
      <div className="bg-[#2a1f3d] border-2 border-orange-500/40 rounded-2xl p-5 shadow mb-5">
        <h2 className="font-bangers text-orange-400 text-lg tracking-widest mb-4">{t.birthdayTermsHeader}</h2>
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
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">{t.birthdayYourDetails}</h2>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.nameLabel} *</label>
            <input type="text" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder={t.birthdayParentNamePlaceholder} />
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

        {/* Birthday child */}
        <div className="bg-white rounded-2xl p-5 shadow flex flex-col gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">{t.birthdayChildSection}</h2>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.birthdayChildName}</label>
            <input type="text" value={form.birthday_child_name}
              onChange={(e) => setForm({ ...form, birthday_child_name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder={t.birthdayChildNamePlaceholder} />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.birthdayTurningAge}</label>
            <input type="number" min="1" max="18" value={form.birthday_child_age}
              onChange={(e) => setForm({ ...form, birthday_child_age: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder={t.birthdayAgePlaceholder} />
          </div>
        </div>

        {/* Event details */}
        <div className="bg-white rounded-2xl p-5 shadow flex flex-col gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">{t.birthdayEventDetails}</h2>

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
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.birthdayStartEndTime} *</label>
            <input type="text" required value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder={t.birthdayStartEndPlaceholder} />
            <p className="text-xs text-gray-400 mt-1">{t.birthdayStartEndHint}</p>
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
            <p className="text-xs text-gray-400 mt-1">{t.birthdayKidsNote}</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.birthdayNotesLabel}</label>
            <textarea value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] resize-none"
              placeholder={t.birthdayNotesPlaceholder} />
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
                <p className="font-bold text-gray-800">{t.birthdayPhotosTitle}</p>
                <span className="font-bold text-[#1a56db] text-base">+1,000 THB</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                {t.birthdayPhotosDesc}
              </p>
            </div>
          </label>
        </div>

        {/* Total */}
        <div className="bg-[#ffe033] rounded-2xl px-5 py-4 shadow">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-800 text-base">{t.total}</span>
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
              { value: "stripe",    label: t.birthdayCardOption },
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
                <p className="text-xs text-gray-500 mb-0.5">{t.birthdayPromptpay2Start}</p>
                <p className="text-2xl font-bold text-[#1a56db]">{formatTHB(total)}</p>
              </div>
            </div>

            <ol className="flex flex-col gap-2 text-xs text-gray-600">
              {[
                t.birthdayPromptpay1,
                `${t.birthdayPromptpay2Start} ${formatTHB(total)} ${t.birthdayPromptpay2End}`,
                t.birthdayPromptpay3,
                t.birthdayPromptpay4,
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
              {t.birthdayTermsCheckbox}
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
          <p className="text-center text-xs text-white/60">{t.birthdayAcceptTerms}</p>
        )}
      </form>

      <style jsx global>{`
        @keyframes floatCake {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { translations, Lang } from "@/lib/i18n/translations";
import { getBirthdayAmount, formatTHB, BirthdayTimeSlot } from "@/lib/pricing";

const TIME_SLOTS: { id: BirthdayTimeSlot; label: string; rate: number; note: string }[] = [
  { id: "morning",   label: "Morning / Off-Peak",  rate: 3000, note: "9:00am – 3:30pm (weekdays)" },
  { id: "afternoon", label: "Afternoon / Peak",     rate: 5000, note: "3:30pm – 6:30pm (weekdays)" },
  { id: "evening",   label: "Evening / Off-Peak",   rate: 3000, note: "6:30pm – 9:30pm (weekdays)" },
  { id: "weekend",   label: "Weekend",              rate: 5000, note: "After 2:00pm (Sat / Sun)" },
];

const HOUR_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4];
const PHOTOGRAPHER_FEE = 1000;

export default function BirthdaysPage() {
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
    birthday_child_name: "",
    birthday_child_age: "",
    payment_method: "cash",
    notes: "",
    photographer_requested: false,
  });
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

      router.push(`/birthdays/submitted`);
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
        </div>
        <LanguageSwitcher current={lang} onChange={handleLang} />
      </div>

      {/* Animated hero */}
      <div className="relative flex justify-center items-center py-6 mb-2">
        <div className="absolute w-64 h-64 rounded-full bg-blue-300/10 animate-pulse" style={{ animationDuration: "2s" }} />
        <div className="absolute w-48 h-48 rounded-full bg-yellow-300/15 animate-pulse" style={{ animationDuration: "3s", animationDelay: "0.5s" }} />
        <span
          className="relative text-[7rem] leading-none select-none animate-bounce"
          style={{ animationDuration: "2.8s", filter: "drop-shadow(0 0 24px rgba(255,210,40,0.55))" }}
        >
          🎂
        </span>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="font-bangers text-5xl text-white tracking-widest drop-shadow-lg mb-1">
          BIRTHDAYS &amp; EVENTS
        </h1>
        <p className="text-white/80 text-sm mb-3">Make it a party they will never forget!</p>
        <span className="inline-block bg-white/20 text-white text-xs font-semibold px-4 py-1.5 rounded-full">
          📍 Big C, Bophut, Koh Samui
        </span>
      </div>

      {/* What's included */}
      <div className="bg-[#1a3a6e] border border-white/10 rounded-2xl p-5 shadow mb-5">
        <h2 className="font-bangers text-yellow-300 text-lg tracking-widest mb-3">🎉 WHAT IS INCLUDED</h2>
        <ul className="flex flex-col gap-2 text-sm text-white/90">
          {[
            "1 guided 50-minute training session",
            "Birthday banners and balloons",
            "Staff assistance throughout",
            "Access to training, climbing & ninja zones",
            "Cleanup service included",
            "5 kids free with every event",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="text-base shrink-0">🥷</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
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
              placeholder="Parent or guardian name" />
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
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Birthday Child</h2>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Child&apos;s Name</label>
            <input type="text" value={form.birthday_child_name}
              onChange={(e) => setForm({ ...form, birthday_child_name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder="Child's name" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Turning Age</label>
            <input type="number" min="1" max="18" value={form.birthday_child_age}
              onChange={(e) => setForm({ ...form, birthday_child_age: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder="e.g. 7" />
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
                  form.time_slot === slot.id
                    ? "border-[#1a56db] bg-blue-50"
                    : "border-gray-200 hover:bg-gray-50"
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
            <p className="text-xs text-gray-400 mt-1">Required so we can reserve your exact time slot.</p>
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
            <p className="text-xs text-gray-400 mt-1">First 5 kids included. Extra kids: 6–10 +500 THB · 11–15 +1,000 THB · 16–20 +1,500 THB</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] resize-none"
              placeholder="Any special requests or info for staff..." />
          </div>
        </div>

        {/* Photographer upgrade */}
        <div className={`rounded-2xl p-4 shadow border-2 transition-colors ${
          form.photographer_requested ? "bg-blue-50 border-[#1a56db]" : "bg-white border-gray-100"
        }`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.photographer_requested}
              onChange={(e) => setForm({ ...form, photographer_requested: e.target.checked })}
              className="mt-1 accent-[#1a56db] w-5 h-5 shrink-0"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-gray-800">📸 Want Photos Too?</p>
                <span className="font-bold text-[#1a56db] text-base">+1,000 THB</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                Staff will capture periodic shots of your event. Digital images will be delivered to your member page within a few days. Higher res may be available upon request to your usb drive. Available for birthdays, events and day camps only.
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
            {form.num_kids > 5 ? " + extra kids" : " (first 5 kids included)"}
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

        {/* Slip upload (PromptPay only) */}
        {form.payment_method === "promptpay" && (
          <div className="bg-white rounded-2xl p-5 shadow">
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.uploadSlip}</label>
            <p className="text-xs text-gray-500 mb-3">{t.slipInstructions}</p>
            <input type="file" accept="image/*"
              onChange={(e) => setSlip(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#1a56db] file:text-white file:font-semibold" />
            {slip && <p className="text-xs text-green-600 mt-2">✓ {slip.name}</p>}
          </div>
        )}

        {error && (
          <div className="bg-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        <button type="submit" disabled={submitting}
          className="bg-[#22c55e] text-white font-bold text-lg rounded-2xl py-4 shadow-lg hover:bg-green-500 transition-colors disabled:opacity-50">
          {submitting ? t.submitting : t.bookBtn}
        </button>
      </form>
    </div>
  );
}

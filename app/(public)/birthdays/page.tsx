"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { translations, Lang } from "@/lib/i18n/translations";
import { getBirthdayAmount, formatTHB, BirthdayTimeSlot } from "@/lib/pricing";

const TIME_SLOTS: { id: BirthdayTimeSlot; label: string; rate: number; note: string }[] = [
  { id: "morning", label: "Morning", rate: 3000, note: "Before 12pm" },
  { id: "afternoon", label: "Afternoon", rate: 5000, note: "12pm - 5pm" },
  { id: "evening", label: "Evening", rate: 3000, note: "5pm - 8pm" },
  { id: "weekend", label: "Weekend", rate: 5000, note: "Sat/Sun any time" },
];

const HOUR_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4];

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

  function handleLang(l: Lang) {
    setLang(l);
    localStorage.setItem("ng_lang", l);
  }

  const total = getBirthdayAmount(form.time_slot, form.num_hours, form.num_kids);
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

      router.push(`/?booked=${data.id}`);
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
        <LanguageSwitcher current={lang} onChange={handleLang} />
      </div>

      {/* Hero image */}
      <div className="rounded-2xl overflow-hidden shadow-xl mb-4 -mx-1">
        <Image
          src="/images/App4_small.png"
          alt="Birthday parties at NinjaGym"
          width={480}
          height={280}
          className="w-full object-cover"
          priority
        />
      </div>

      <h1 className="font-fredoka text-3xl text-white drop-shadow mb-1">{t.birthdayTitle}</h1>
      <p className="font-bangers text-base text-[#ffe033] tracking-widest mb-2">MAKE IT A PARTY THEY WILL NEVER FORGET!</p>
      <p className="text-white/70 text-xs mb-5">📍 Big C, Bophut, Koh Samui</p>

      {/* What's included */}
      <div className="bg-[#1a56db] rounded-2xl p-4 shadow mb-5">
        <h2 className="font-bold text-white text-sm uppercase tracking-wide mb-3">What&apos;s Included</h2>
        <ul className="flex flex-col gap-1.5 text-sm text-white/90">
          {["1 guided 50-minute training session","Birthday decorations & staff assistance","Access to training, climbing & ninja zones","Cleanup service included","5 kids free with every event"].map(item => (
            <li key={item} className="flex items-start gap-2"><span>🥷</span><span>{item}</span></li>
          ))}
        </ul>
      </div>


      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Contact */}
        <div className="bg-white rounded-2xl p-4 shadow flex flex-col gap-3">
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
        <div className="bg-white rounded-2xl p-4 shadow flex flex-col gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Birthday Child</h2>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.birthdayChildName}</label>
            <input type="text" value={form.birthday_child_name}
              onChange={(e) => setForm({ ...form, birthday_child_name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder="Child's name" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.birthdayChildAge}</label>
            <input type="number" min="1" max="18" value={form.birthday_child_age}
              onChange={(e) => setForm({ ...form, birthday_child_age: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder="Age" />
          </div>
        </div>

        {/* Event details */}
        <div className="bg-white rounded-2xl p-4 shadow flex flex-col gap-3">
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
                <label key={slot.id} className={`flex flex-col px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                  form.time_slot === slot.id ? "border-[#1a56db] bg-blue-50" : "border-gray-100 hover:bg-gray-50"
                }`}>
                  <input type="radio" name="time_slot" value={slot.id}
                    checked={form.time_slot === slot.id}
                    onChange={() => setForm({ ...form, time_slot: slot.id })}
                    className="sr-only" />
                  <span className="text-sm font-bold text-gray-800">{slot.label}</span>
                  <span className="text-xs text-gray-500">{slot.note}</span>
                  <span className="text-xs font-semibold text-[#1a56db]">{formatTHB(slot.rate)}/hr</span>
                </label>
              ))}
            </div>
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
            <p className="text-xs text-gray-400 mt-1">First 5 kids included. Extra kids: 6-10 +500 THB, 11-15 +1,000 THB, 16-20 +1,500 THB</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Time display (optional)</label>
            <input type="text" value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              placeholder="e.g. 2pm-4pm" />
          </div>
        </div>

        {/* Price summary */}
        <div className="bg-[#ffe033] rounded-2xl px-4 py-3 shadow">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bangers text-lg text-[#1a56db] tracking-wide">ESTIMATED TOTAL</span>
            <span className="font-fredoka text-2xl text-[#1a56db]">{formatTHB(total)}</span>
          </div>
          <p className="text-xs text-[#1a56db]/70">
            {selectedSlot.rate} THB/hr x {form.num_hours} hrs
            {form.num_kids > 5 ? ` + extra kids` : " (first 5 kids included)"}
          </p>
        </div>

        {/* Payment method */}
        <div className="bg-white rounded-2xl p-4 shadow">
          <label className="block text-sm font-bold text-gray-700 mb-2">{t.paymentMethodLabel}</label>
          <div className="flex flex-col gap-2">
            {[
              { value: "promptpay", label: `📱 ${t.promptpayOption}` },
              { value: "cash", label: `💵 ${t.cashOption}` },
            ].map((opt) => (
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
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.uploadSlip}</label>
            <p className="text-xs text-gray-500 mb-3">{t.slipInstructions}</p>
            <input type="file" accept="image/*"
              onChange={(e) => setSlip(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#1a56db] file:text-white file:font-semibold" />
            {slip && <p className="text-xs text-green-600 mt-2">Selected: {slip.name}</p>}
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

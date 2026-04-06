"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { translations, Lang } from "@/lib/i18n/translations";
import { MEMBERSHIP_TYPES, BASE_PRICES, getPriceForType, calcBulkPrice, formatTHB } from "@/lib/pricing";
import { MembershipType } from "@/types";

const StripePayment = lazy(() => import("@/components/public/StripePayment"));

// Session types that benefit from a focus selection
const SESSION_TYPES_WITH_FOCUS = new Set([
  "session_1to1", "day_camp", "all_day",
]);

const SESSION_FOCUS_GROUPS = [
  {
    label: "🥋 Stances",
    options: [
      "Horse / Side Stance", "Cat Stance", "Defensive Stance", "Power Stance",
      "Fighting Stance", "Low Stance", "Bow / Open Stance", "Blade Stance",
      "Reactive Stance", "Combat Stance",
    ],
  },
  {
    label: "🔄 Rolls & Falls",
    options: ["Front Roll", "Back Roll", "Side Roll", "Breakfall", "Dive Roll"],
  },
  {
    label: "🦵 Kicks",
    options: [
      "Front Kick", "Side Kick", "Roundhouse Kick", "Back Kick",
      "Spinning Kick", "Jump Kick", "Axe Kick",
    ],
  },
  {
    label: "👊 Strikes",
    options: ["Straight Punch", "Palm Strike", "Hammer Fist", "Elbow Strike", "Knife Hand"],
  },
  {
    label: "🤸 Jumps & Parkour",
    options: [
      "Precision Jump", "Long Jump", "Vault", "Wall Run",
      "Climb & Descent", "Balance Beam", "Kong Vault",
    ],
  },
  {
    label: "🧗 Climbing",
    options: ["Rope Climb", "Wall Climb", "Bouldering", "Traverse Wall"],
  },
  {
    label: "🎯 General",
    options: ["Flexibility & Stretching", "Ninja Conditioning", "Free Play", "Games"],
  },
];

const WAIVER_RULES = [
  { icon: "⚠️", text: "Participation is at **your own risk**. Areas of the center are dangerous and similar to a public playground." },
  { icon: "👧", text: "**Only Kids** (no parents or guardians) on the mat." },
  { icon: "🚫", text: "Kids only enter after a **NinjaGym Guide** has brought them into the center." },
  { icon: "📢", text: "No **Yelling**, fighting, disruptive behavior, or ignoring a Guide. Kids must behave or be asked to sit out." },
  { icon: "👥", text: "**Parents are responsible** for ensuring their kids follow the rules and Guides. We want to focus on our program." },
  { icon: "⏱️", text: "Each session is **55 minutes** long." },
  { icon: "🚧", text: "Inform your kids to **NOT MOVE** or disrupt our equipment." },
  { icon: "🚪", text: "Please **depart shortly after** a session. No children playing in entry areas." },
  { icon: "🍔", text: "If you bring in food or drinks, clean up after yourself." },
  { icon: "🎓", text: "Sessions are **\"learn by doing\"** with a relaxed, fun environment. Not a strict martial arts class." },
  { icon: "📷", text: "By registering, you **consent to photos/video** being taken during sessions for marketing use." },
  { icon: "💰", text: "**No Refunds**. All sales are final once the session has begun." },
];

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
    payment_method: "cash",
    notes: "",
  });
  const [slip, setSlip] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [existingMember, setExistingMember] = useState<{ id: number; name: string } | null>(null);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [sessionFocus, setSessionFocus] = useState("");
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [showWaiver, setShowWaiver] = useState(false);
  // Stripe two-step state
  const [sessionQty, setSessionQty] = useState(5);
  const [stripeStep, setStripeStep] = useState(false);
  const [pendingMemberId, setPendingMemberId] = useState<number | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [cashStaffName, setCashStaffName] = useState("");
  const [waterQty, setWaterQty] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("ng_lang") as Lang | null;
    if (saved) setLang(saved);
  }, []);

  function handleLang(l: Lang) {
    setLang(l);
    localStorage.setItem("ng_lang", l);
  }

  const selectedMt = MEMBERSHIP_TYPES.find((m) => m.id === form.membership_type);
  const WATER_PRICE = 15;
  const basePrice = selectedMt?.bulk
    ? calcBulkPrice(BASE_PRICES[selectedMt.bulkBase!] ?? 0, sessionQty)
    : getPriceForType(form.membership_type, form.kids_count);
  const price = basePrice + waterQty * WATER_PRICE;

  async function compressImage(file: File, maxPx: number): Promise<File> {
    return new Promise((resolve) => {
      const img = document.createElement("img");
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file);
        }, "image/jpeg", 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, String(v)));
      body.append("amount_paid", String(price));
      body.append("lang", lang);
      if (selectedMt?.bulk) body.append("sessions_remaining", String(sessionQty));
      const focusPart = sessionFocus ? `Focus: ${sessionFocus}` : "";
      const staffPart = form.payment_method === "cash" && cashStaffName ? `Staff: ${cashStaffName}` : "";
      const waterPart = waterQty > 0 ? `Water x${waterQty} (+${waterQty * WATER_PRICE} THB)` : "";
      const notesPart = form.notes || "";
      const combinedNotes = [focusPart, staffPart, waterPart, notesPart].filter(Boolean).join(" | ");
      if (combinedNotes) body.append("notes", combinedNotes);
      if (slip && form.payment_method === "promptpay") {
        const compressed = await compressImage(slip, 1400);
        body.append("slip", compressed, slip.name);
      }

      const res = await fetch("/api/members", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Submission failed");

      if (form.payment_method === "stripe") {
        setPendingMemberId(data.id);
        setPendingToken(data.token ?? null);
        setStripeStep(true);
        setSubmitting(false);
      } else {
        router.push(`/qr/card/${data.id}?token=${data.token}`);
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
              description={`NinjaGym membership: ${form.membership_type}`}
              referenceId={pendingMemberId}
              referenceType="member"
              onSuccess={() => router.push(`/qr/card/${pendingMemberId}?token=${pendingToken ?? ""}`)}
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
      <h1 className="font-fredoka text-3xl text-white drop-shadow mb-5">{t.joinTitle}</h1>

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
            placeholder="First and Last Name (or last Initial)"
          />
        </div>

        {/* Phone */}
        <div className="bg-white rounded-2xl p-4 shadow">
          <label className="block text-sm font-bold text-gray-700 mb-1">{t.phoneLabel}</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => { setForm({ ...form, phone: e.target.value }); setExistingMember(null); }}
            onBlur={async (e) => {
              const phone = e.target.value.trim();
              if (phone.length < 6) return;
              const res = await fetch(`/api/check-phone?phone=${encodeURIComponent(phone)}`);
              const data = await res.json();
              if (data.found) setExistingMember({ id: data.id, name: data.name });
            }}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            placeholder="+66 80 000 0000"
          />
          {existingMember && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-amber-800 font-bold text-sm">
                📱 We found an existing account for {existingMember.name}!
              </p>
              <p className="text-amber-700 text-xs mt-1">
                No need to register again. You can top up or add sessions directly from your member card.
              </p>
              <a
                href={`/qr/card/${existingMember.id}`}
                className="inline-block mt-2 bg-[#1a56db] text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
              >
                Go to My Card →
              </a>
              <p className="text-amber-600 text-xs mt-2">
                Registering for a <em>different</em> program? Continue below.
              </p>
            </div>
          )}
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
              required
              value={form.kids_names}
              onChange={(e) => setForm({ ...form, kids_names: e.target.value })}
              className={`w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] ${
                !form.kids_names.trim() ? "border-red-300 bg-red-50" : "border-gray-200"
              }`}
              placeholder="e.g. Tom, Lisa"
            />
            {!form.kids_names.trim() && (
              <p className="text-xs text-red-500 mt-1">Required — so staff can find the right child.</p>
            )}
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
          <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-0.5">
            {MEMBERSHIP_TYPES.filter((mt: MembershipType) => mt.id !== "birthday_event").map((mt: MembershipType) => {
              const isBulk = !!mt.bulk;
              const p = isBulk
                ? calcBulkPrice(BASE_PRICES[mt.bulkBase!] ?? 0, sessionQty)
                : getPriceForType(mt.id, form.kids_count);
              const isSelected = form.membership_type === mt.id;
              const isOpen = expandedNote === mt.id;
              return (
                <div key={mt.id} className="flex flex-col">
                  <label
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer border transition-colors ${
                      isSelected ? "border-[#1a56db] bg-blue-50" : "border-gray-100 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="radio"
                        name="membership_type"
                        value={mt.id}
                        checked={isSelected}
                        onChange={() => setForm({ ...form, membership_type: mt.id })}
                        className="accent-[#1a56db] shrink-0"
                      />
                      <span className="text-sm font-medium text-gray-800 truncate">{mt.label}</span>
                      {mt.perKid && (
                        <span className="text-xs text-gray-400 shrink-0">×{form.kids_count}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-sm font-bold text-[#1a56db]">{formatTHB(p)}</span>
                      {mt.note && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setExpandedNote(isOpen ? null : mt.id); }}
                          className="w-5 h-5 rounded-full bg-gray-200 hover:bg-[#1a56db] hover:text-white text-gray-500 text-xs font-bold flex items-center justify-center transition-colors"
                          title="More info"
                        >
                          i
                        </button>
                      )}
                    </div>
                  </label>

                  {/* Bulk qty slider — shown when this bulk type is selected */}
                  {isBulk && isSelected && (
                    <div className="mx-3 mb-1 px-3 py-3 bg-blue-50 border border-[#1a56db]/20 rounded-b-xl">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-semibold text-gray-700">{sessionQty} sessions</span>
                        <span className="text-green-600 font-bold">{Math.min(sessionQty, 20)}% off</span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={20}
                        value={sessionQty}
                        onChange={(e) => setSessionQty(Number(e.target.value))}
                        className="w-full accent-[#1a56db]"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>5 sessions (5% off)</span>
                        <span>20 sessions (20% off)</span>
                      </div>
                    </div>
                  )}

                  {/* Info note */}
                  {isOpen && mt.note && !isBulk && (
                    <div className="mx-3 mb-1 px-3 py-2 bg-blue-50 border border-[#1a56db]/20 rounded-b-xl text-xs text-gray-600 leading-relaxed">
                      {mt.note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Water add-on */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">💧</span>
            <span className="text-sm font-semibold text-gray-700">Add Water</span>
            <span className="text-xs text-gray-400">{formatTHB(WATER_PRICE)} each</span>
          </div>
          <div className="flex items-center gap-2">
            {waterQty > 0 && (
              <button type="button" onClick={() => setWaterQty(Math.max(0, waterQty - 1))} className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center hover:bg-gray-200">−</button>
            )}
            <span className="text-sm font-bold text-gray-700 w-5 text-center">{waterQty}</span>
            <button type="button" onClick={() => setWaterQty(Math.min(10, waterQty + 1))} className="w-7 h-7 rounded-full bg-[#1a56db] text-white font-bold text-sm flex items-center justify-center hover:bg-blue-700">+</button>
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
            {/* Cash — green */}
            <label className={`flex items-center gap-3 px-3 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
              form.payment_method === "cash" ? "border-green-500 bg-green-100" : "border-green-200 bg-green-50"
            }`}>
              <input
                type="radio"
                name="payment_method"
                value="cash"
                checked={form.payment_method === "cash"}
                onChange={() => setForm({ ...form, payment_method: "cash" })}
                className="accent-green-500"
              />
              <span className="text-sm font-semibold text-green-700">💵 {t.cashOption}</span>
            </label>
            {/* PromptPay — blue */}
            <label className={`flex items-center gap-3 px-3 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
              form.payment_method === "promptpay" ? "border-[#1a56db] bg-blue-100" : "border-blue-200 bg-blue-50"
            }`}>
              <input
                type="radio"
                name="payment_method"
                value="promptpay"
                checked={form.payment_method === "promptpay"}
                onChange={() => setForm({ ...form, payment_method: "promptpay" })}
                className="accent-[#1a56db]"
              />
              <span className="text-sm font-semibold text-[#1a56db]">
                📱 {t.promptpayOption}
              </span>
            </label>
            {/* Credit/Debit Card — hidden for now, keep for easy re-enable */}
            {/* <label className={`flex items-center gap-3 px-3 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
              form.payment_method === "stripe" ? "border-[#1a56db] bg-blue-50" : "border-gray-100 hover:bg-gray-50"
            }`}>
              <input
                type="radio"
                name="payment_method"
                value="stripe"
                checked={form.payment_method === "stripe"}
                onChange={() => setForm({ ...form, payment_method: "stripe" })}
                className="accent-[#1a56db]"
              />
              <span className="text-sm font-semibold text-gray-700">💳 {t.cardOption}</span>
            </label> */}
          </div>
        </div>


        {/* PromptPay panel — QR + account details + slip upload */}
        {form.payment_method === "promptpay" && (
          <div className="bg-white rounded-2xl p-4 shadow flex flex-col gap-4">
            {/* QR + account */}
            <div className="bg-blue-50 rounded-xl px-4 py-4 text-center">
              <p className="text-xs font-bold text-[#1a56db] uppercase tracking-wide mb-3">Scan to Pay</p>
              <Image
                src="/images/promptpay-qr-small.png"
                alt="PromptPay QR Code"
                width={160}
                height={160}
                className="mx-auto mb-3 rounded-xl"
              />
              <p className="text-xs text-gray-500 mb-0.5">PromptPay Number</p>
              <p className="font-fredoka text-2xl text-[#1a56db] tracking-widest">086-294-4374</p>
              <p className="text-sm text-gray-600 mt-0.5 font-semibold">Rick Tew Co., Ltd.</p>
              <div className="mt-2 pt-2 border-t border-blue-200">
                <p className="text-xs text-gray-500 mb-0.5">Bangkok Bank Account</p>
                <p className="font-fredoka text-lg text-[#1a56db] tracking-widest">451-7-17573-5</p>
              </div>
            </div>
            {/* Amount reminder */}
            <div className="bg-[#ffe033] rounded-xl px-4 py-3 text-center">
              <p className="text-xs font-bold text-[#1a56db] uppercase tracking-wide mb-0.5">Amount to Transfer</p>
              <p className="font-fredoka text-2xl text-[#1a56db]">{formatTHB(price)}</p>
            </div>
            {/* Steps */}
            <ol className="flex flex-col gap-2 text-sm text-gray-600">
              <li className="flex items-start gap-2"><span className="bg-[#1a56db] text-white font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>Open any Thai banking app and scan the QR above, or transfer to the PromptPay number.</li>
              <li className="flex items-start gap-2"><span className="bg-[#1a56db] text-white font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>Transfer the exact amount shown above.</li>
              <li className="flex items-start gap-2"><span className="bg-[#1a56db] text-white font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>Screenshot the confirmation screen showing the amount, recipient name, and transaction reference.</li>
              <li className="flex items-start gap-2"><span className="bg-[#1a56db] text-white font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">4</span>Upload the screenshot below. Staff will approve within minutes.</li>
            </ol>
            {/* Slip upload */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t.uploadSlip}</label>
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
          </div>
        )}

        {/* Training Session Focus — only for single-session types */}
        {SESSION_TYPES_WITH_FOCUS.has(form.membership_type) && (
          <div className="bg-white rounded-2xl p-4 shadow">
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Training Session Focus <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">What would you like to focus on in your session?</p>
            <select
              value={sessionFocus}
              onChange={(e) => setSessionFocus(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            >
              <option value="">No preference</option>
              {SESSION_FOCUS_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        {error && (
          <div className="bg-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* Policy agreement */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow flex items-start gap-3">
          <input
            type="checkbox"
            id="policy-check"
            checked={agreedToPolicy}
            onChange={(e) => setAgreedToPolicy(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#1a56db] shrink-0"
            required
          />
          <label htmlFor="policy-check" className="text-sm text-gray-700 leading-snug">
            {t.policyBefore}{" "}
            <button
              type="button"
              onClick={() => setShowWaiver(true)}
              className="text-[#1a56db] font-semibold underline underline-offset-2"
            >
              {t.policyLink}
            </button>{" "}
            {t.policyAfter}
          </label>
        </div>

        {form.payment_method === "promptpay" && !slip && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-2xl px-4 py-3 text-center">
            <p className="text-yellow-800 font-semibold text-sm">📎 Please upload your PromptPay receipt above to complete registration.</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !agreedToPolicy || (form.payment_method === "promptpay" && !slip) || !form.kids_names.trim()}
          className="bg-[#22c55e] text-white font-bold text-lg rounded-2xl py-4 shadow-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? t.submitting
            : form.payment_method === "stripe"
            ? "Register & Pay by Card →"
            : t.submitBtn}
        </button>
      </form>

      {/* Waiver Modal */}
      {showWaiver && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85dvh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#1a56db] to-[#2563eb] rounded-t-2xl">
              <h2 className="font-fredoka text-lg text-white">🥷 {t.waiverTitle}</h2>
              <button
                onClick={() => setShowWaiver(false)}
                className="text-white/70 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>
            {/* Rules list */}
            <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-3">
              {WAIVER_RULES.map((rule, i) => (
                <div key={i} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                  <span className="text-xl shrink-0">{rule.icon}</span>
                  <p
                    className="text-sm text-gray-700 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: rule.text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"),
                    }}
                  />
                </div>
              ))}
            </div>
            {/* Close button */}
            <div className="px-5 pb-5 pt-2">
              <button
                onClick={() => { setAgreedToPolicy(true); setShowWaiver(false); }}
                className="w-full bg-[#1a56db] text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors"
              >
                {t.waiverClose}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { translations, Lang } from "@/lib/i18n/translations";

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
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [existingMember, setExistingMember] = useState<{ id: number; name: string; token?: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string; kids_names?: string }>({});

  function validateName(val: string): string | undefined {
    const v = val.trim();
    if (!v) return "Please enter your full name.";
    if (!/^[\p{L}\s'\-.]+$/u.test(v)) return "Name should only contain letters — no numbers or symbols.";
    const words = v.split(/\s+/);
    if (words.length < 2) return "Please enter your first and last name (or last initial).";
    if (words.some((w) => w.length < 2)) return "Each part of your name should be at least 2 characters.";
  }

  function validatePhone(val: string): string | undefined {
    if (!val.trim()) return; // optional field
    const digits = val.replace(/[\s\-+().]/g, "");
    if (!/^\d+$/.test(digits)) return "Phone should contain only numbers.";
    if (digits.length < 7 || digits.length > 15) return "Please enter a valid phone number.";
  }

  function validateKidsNames(val: string): string | undefined {
    const v = val.trim();
    if (!v) return "Required — so staff can find the right child.";
    if (!/^[\p{L}\s,'\-.]+$/u.test(v)) return "Names should only contain letters, commas, or hyphens.";
    if (v.length < 2) return "Please enter at least one kid's name.";
  }

  function setFieldError(field: keyof typeof fieldErrors, msg: string | undefined) {
    setFieldErrors((e) => ({ ...e, [field]: msg }));
  }
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [showWaiver, setShowWaiver] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ng_lang") as Lang | null;
    if (saved) setLang(saved);
  }, []);

  function handleLang(l: Lang) {
    setLang(l);
    localStorage.setItem("ng_lang", l);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Run all validations before submitting
    const nameErr      = validateName(form.name);
    const phoneErr     = validatePhone(form.phone);
    const kidsNamesErr = validateKidsNames(form.kids_names);
    setFieldErrors({ name: nameErr, phone: phoneErr, kids_names: kidsNamesErr });
    if (nameErr || phoneErr || kidsNamesErr) return;

    setSubmitting(true);
    setError("");

    try {
      const body = new FormData();
      body.append("name", form.name);
      body.append("phone", form.phone);
      body.append("email", form.email);
      body.append("kids_names", form.kids_names);
      body.append("kids_count", "1");  // default; parent sets actual count when choosing program
      body.append("membership_type", "session_group");  // placeholder — no sessions yet
      body.append("payment_method", "self_register");   // auto-approved, 0 sessions
      body.append("sessions_remaining", "0");
      body.append("amount_paid", "0");
      body.append("lang", lang);

      const res = await fetch("/api/members", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Submission failed");

      router.push(`/qr/card/${data.id}?token=${data.token}`);
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

      <h1 className="font-fredoka text-3xl text-white drop-shadow mb-1">{t.joinTitle}</h1>
      <p className="text-white/80 text-sm mb-5">Get your member card in seconds. Choose your program on the next screen.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Name */}
        <div className="bg-white rounded-2xl p-4 shadow">
          <label className="block text-sm font-bold text-gray-700 mb-1">{t.nameLabel} *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => { setForm({ ...form, name: e.target.value }); setFieldError("name", undefined); }}
            onBlur={(e) => setFieldError("name", validateName(e.target.value))}
            className={`w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] ${fieldErrors.name ? "border-red-300 bg-red-50" : "border-gray-200"}`}
            placeholder="First and Last Name (or last Initial)"
          />
          {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
        </div>

        {/* Phone */}
        <div className="bg-white rounded-2xl p-4 shadow">
          <label className="block text-sm font-bold text-gray-700 mb-1">{t.phoneLabel}</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => { setForm({ ...form, phone: e.target.value }); setExistingMember(null); setFieldError("phone", undefined); }}
            onBlur={async (e) => {
              const phone = e.target.value.trim();
              setFieldError("phone", validatePhone(phone));
              if (phone.length < 6) return;
              const res = await fetch(`/api/check-phone?phone=${encodeURIComponent(phone)}`);
              const data = await res.json();
              if (data.found) setExistingMember({ id: data.id, name: data.name, token: data.token });
            }}
            className={`w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] ${fieldErrors.phone ? "border-red-300 bg-red-50" : "border-gray-200"}`}
            placeholder="+66 80 000 0000"
          />
          {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
          {existingMember && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-amber-800 font-bold text-sm">
                📱 We found an existing account for {existingMember.name}!
              </p>
              <p className="text-amber-700 text-xs mt-1">
                No need to register again — go straight to your member card.
              </p>
              <a
                href={`/qr/card/${existingMember.id}`}
                className="inline-block mt-2 bg-[#1a56db] text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
              >
                Go to My Card →
              </a>
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
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.kidsNamesLabel} *</label>
            <input
              type="text"
              required
              value={form.kids_names}
              onChange={(e) => { setForm({ ...form, kids_names: e.target.value }); setFieldError("kids_names", undefined); }}
              onBlur={(e) => setFieldError("kids_names", validateKidsNames(e.target.value))}
              className={`w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] ${
                fieldErrors.kids_names ? "border-red-300 bg-red-50" : "border-gray-200"
              }`}
              placeholder="e.g. Tom, Lisa"
            />
            {fieldErrors.kids_names && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.kids_names}</p>
            )}
          </div>
        </div>

        {/* What happens next */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-sm text-blue-800">
          <p className="font-bold mb-1">🥷 What happens next?</p>
          <p>You&apos;ll get your member card with a PIN number. Next, you pick your first program, number of kids attending and payment type.</p>
        </div>

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

        <button
          type="submit"
          disabled={submitting || !agreedToPolicy || !form.kids_names.trim()}
          className="bg-[#22c55e] text-white font-bold text-lg rounded-2xl py-4 shadow-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating your card..." : "Get My Member Card →"}
        </button>
      </form>

      {/* Waiver Modal */}
      {showWaiver && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85dvh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#1a56db] to-[#2563eb] rounded-t-2xl">
              <h2 className="font-fredoka text-lg text-white">🥷 {t.waiverTitle}</h2>
              <button
                onClick={() => setShowWaiver(false)}
                className="text-white/70 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>
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

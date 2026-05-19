"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import LegalFooter from "@/components/public/LegalFooter";
import { translations, Lang } from "@/lib/i18n/translations";

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
    if (!v) return t.errNameRequired;
    if (!/^[\p{L}\s'\-.]+$/u.test(v)) return t.errNameLettersOnly;
    const words = v.split(/\s+/);
    if (words.length < 2) return t.errNameFullName;
    if (words.some((w) => w.length < 2)) return t.errNamePartTooShort;
  }

  function validatePhone(val: string): string | undefined {
    if (!val.trim()) return; // optional field
    const digits = val.replace(/[\s\-+().]/g, "");
    if (!/^\d+$/.test(digits)) return t.errPhoneNumbersOnly;
    if (digits.length < 7 || digits.length > 15) return t.errPhoneInvalid;
  }

  function validateKidsNames(val: string): string | undefined {
    const v = val.trim();
    if (!v) return t.errKidsRequired;
    if (!/^[\p{L}\s,'\-.]+$/u.test(v)) return t.errKidsLettersOnly;
    if (v.length < 2) return t.errKidsNameTooShort;
  }

  function setFieldError(field: keyof typeof fieldErrors, msg: string | undefined) {
    setFieldErrors((e) => ({ ...e, [field]: msg }));
  }
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);

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
      body.append("membership_type", "session_group");  // placeholder, no sessions yet
      body.append("payment_method", "self_register");   // auto-approved, 0 sessions
      body.append("sessions_remaining", "0");
      body.append("amount_paid", "0");
      body.append("lang", lang);

      const res = await fetch("/api/members", { method: "POST", body });
      const data = await res.json();

      // Duplicate hard-block from the server. Surface their existing card
      // as the existingMember banner so they get a one-tap path back to
      // their PIN instead of a generic error message.
      if (res.status === 409 && data?.code === "duplicate_member" && data?.existing?.id) {
        setExistingMember({ id: data.existing.id, name: data.existing.name });
        setError("");
        setSubmitting(false);
        return;
      }

      if (!res.ok) throw new Error(data.error || t.errSomethingWrong);

      router.push(`/qr/card/${data.id}?token=${data.token}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.errSomethingWrong);
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white/70 hover:text-white text-sm">{t.back}</Link>
          <Image src="/images/logo_small.png" alt="NinjaGym" width={36} height={36} />
        </div>
        <LanguageSwitcher current={lang} onChange={handleLang} />
      </div>

      <h1 className="font-fredoka text-3xl text-white drop-shadow mb-1">{t.joinTitle}</h1>
      <p className="text-white/80 text-sm mb-5">{t.joinSubtitle}</p>

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
              // Pass all 3 signals so the server can apply the 2-of-3 rule.
              // A single field is never enough — we lost three families on
              // 2026-05-19 when fuzzy phone alone misrouted parents to
              // someone else's card.
              const qs = new URLSearchParams({
                name:  form.name.trim(),
                phone,
                email: form.email.trim(),
              }).toString();
              try {
                const res = await fetch(`/api/check-phone?${qs}`);
                const data = await res.json();
                if (data.found) setExistingMember({ id: data.id, name: data.name, token: data.token });
              } catch {}
            }}
            className={`w-full border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] ${fieldErrors.phone ? "border-red-300 bg-red-50" : "border-gray-200"}`}
            placeholder="+66 80 000 0000"
          />
          {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
          {existingMember && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-amber-800 font-bold text-sm">
                📱 {t.joinFoundAccount} ({existingMember.name})
              </p>
              <p className="text-amber-700 text-xs mt-1">
                {t.joinFoundAccountNote}
              </p>
              <a
                href={`/my-membership`}
                className="inline-block mt-2 bg-[#1a56db] text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
              >
                {t.joinGoToCard}
              </a>
              <p className="text-amber-600 text-[11px] mt-2 leading-snug">
                {t.joinAskStaffFallback}
              </p>
            </div>
          )}
        </div>

        {/* Email, same duplicate check as phone, since a chunk of returning
            parents type a new number but remember their email. */}
        <div className="bg-white rounded-2xl p-4 shadow">
          <label className="block text-sm font-bold text-gray-700 mb-1">{t.emailLabel}</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => { setForm({ ...form, email: e.target.value }); setExistingMember(null); }}
            onBlur={async (e) => {
              const em = e.target.value.trim();
              if (em.length < 5 || !em.includes("@")) return;
              // Pass all 3 signals so the server can apply the 2-of-3 rule.
              const qs = new URLSearchParams({
                name:  form.name.trim(),
                phone: form.phone.trim(),
                email: em,
              }).toString();
              try {
                const res = await fetch(`/api/check-phone?${qs}`);
                const data = await res.json();
                if (data.found) setExistingMember({ id: data.id, name: data.name });
              } catch {}
            }}
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
          <p className="font-bold mb-1">🥷 {t.joinWhatNext}</p>
          <p>{t.joinWhatNextDesc}</p>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* Terms + Privacy consent.
            Two explicit links so PDPA's 'inform-and-consent' obligation is
            met for both: parents can open the full Terms page (waiver,
            conduct, refunds) and the Privacy page (data handling, retention,
            rights) in new tabs without losing the form. One bundled checkbox
            is acceptable since both items are clearly identified. */}
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
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1a56db] font-semibold underline underline-offset-2"
            >
              {t.policyLink}
            </Link>{" "}
            {t.policyAnd}{" "}
            <Link
              href="/policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1a56db] font-semibold underline underline-offset-2"
            >
              {t.policyLinkPrivacy}
            </Link>
            {". "}
            <span className="font-bold text-red-600">{t.policyAfter}</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting || !agreedToPolicy || !form.kids_names.trim()}
          className="bg-[#22c55e] text-white font-bold text-lg rounded-2xl py-4 shadow-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t.joinCreatingCard : t.joinGetCard}
        </button>
      </form>

      <LegalFooter />
    </div>
  );
}

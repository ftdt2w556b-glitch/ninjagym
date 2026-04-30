"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { translations, Lang } from "@/lib/i18n/translations";

const numpadKeys = ["1","2","3","4","5","6","7","8","9","CLR","0","⌫"];

export default function MyMembershipPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const t = translations[lang];

  const [mode, setMode] = useState<"pin" | "name">("pin");

  // PIN state
  const [digits, setDigits]         = useState<string[]>([]);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError]     = useState("");
  const [shake, setShake]           = useState(false);

  // Name+phone state
  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("ng_lang") as Lang | null;
    if (saved) setLang(saved);
  }, []);

  function handleLang(l: Lang) {
    setLang(l);
    localStorage.setItem("ng_lang", l);
  }

  // ── PIN numpad ──────────────────────────────────────────────────

  async function lookupByPin(pin: string) {
    setPinLoading(true);
    setPinError("");
    try {
      const res = await fetch(`/api/scanner/lookup?pin=${pin}`);
      const data = await res.json();
      if (!res.ok || !data?.id) { triggerPinError(); setPinLoading(false); return; }
      // Keep spinner showing until navigation completes — don't reset loading
      router.push(`/qr/card/${data.id}?token=${data.token}`);
    } catch {
      triggerPinError();
      setPinLoading(false);
    }
  }

  function triggerPinError() {
    setShake(true);
    setPinError(t.myMembershipPinNotFound);
    setTimeout(() => { setShake(false); setPinError(""); setDigits([]); }, 1800);
  }

  function pressDigit(d: string) {
    if (pinLoading || shake) return;
    if (digits.length >= 4) return;
    const next = [...digits, d];
    setDigits(next);
    if (next.length === 4) lookupByPin(next.join(""));
  }

  function pressBackspace() {
    if (pinLoading || shake) return;
    setDigits((p) => p.slice(0, -1));
    setPinError("");
  }

  function pressClear() {
    if (pinLoading || shake) return;
    setDigits([]);
    setPinError("");
  }

  // ── Name+phone lookup ───────────────────────────────────────────

  // Maps API error codes (from /api/find-member) to translation keys
  const ERROR_CODE_MAP: Record<string, keyof typeof t> = {
    NAME_PHONE_REQUIRED: "errEnterNamePhone",
    PHONE_TOO_SHORT:     "errPhoneTooShort",
    NO_MEMBERSHIP:       "errNoMembership",
    PHONE_MISMATCH:      "errPhoneMismatch",
    PIN_NOT_FOUND:       "myMembershipPinNotFound",
  };

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/find-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        const key = data.code ? ERROR_CODE_MAP[data.code] : undefined;
        setError(key ? t[key] : (data.error ?? t.errSomethingWrong));
      } else {
        router.push(`/qr/card/${data.id}?token=${data.token}`);
      }
    } catch {
      setError(t.errSomethingWrong);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-5 py-10">

      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher current={lang} onChange={handleLang} />
      </div>

      <div className="mb-5">
        <Image src="/images/logo_small.png" alt="NinjaGym" width={100} height={100} className="drop-shadow-xl" priority />
      </div>

      <div className="w-full bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl px-6 py-8">
        <h1 className="font-fredoka text-3xl text-center text-[#1a56db] mb-1">
          {t.myMembershipTitle}
        </h1>

        {/* ── PIN mode ── */}
        {mode === "pin" && (
          <>
            <p className="text-gray-500 text-sm text-center mb-6">{t.myMembershipPinSubtitle}</p>

            <div className="flex flex-col items-center gap-5">
              {/* Dots */}
              <div className="flex gap-4">
                {[0,1,2,3].map((i) => (
                  <div key={i} className={`w-5 h-5 rounded-full transition-all duration-150 ${
                    shake ? "bg-red-500" : i < digits.length ? "bg-[#1a56db]" : "bg-gray-200"
                  }`} />
                ))}
              </div>

              {pinError && <p className="text-red-500 text-sm text-center">{pinError}</p>}

              {pinLoading ? (
                <div className="flex items-center gap-2 text-gray-400 py-4">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  <span className="text-sm">{t.pinLookingUp}</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
                  {numpadKeys.map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        if (key === "⌫") pressBackspace();
                        else if (key === "CLR") pressClear();
                        else pressDigit(key);
                      }}
                      className="py-4 rounded-2xl font-bold text-xl bg-gray-100 text-gray-800 hover:bg-gray-200 active:scale-95 transition-all select-none"
                    >
                      {key}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => { setMode("name"); setDigits([]); setPinError(""); }}
                className="text-gray-400 text-xs hover:text-gray-600 transition-colors mt-1"
              >
                {t.myMembershipForgotPin}
              </button>
            </div>
          </>
        )}

        {/* ── Name+phone mode ── */}
        {mode === "name" && (
          <>
            <button
              onClick={() => { setMode("pin"); setError(""); }}
              className="text-[#1a56db] text-xs mb-4 hover:underline block"
            >
              {t.myMembershipBackToPin}
            </button>

            <p className="text-gray-500 text-sm text-center mb-6">{t.myMembershipSubtitle}</p>

            <form onSubmit={handleLookup} className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">{t.nameLabel}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sarah"
                  required
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-[#1a56db] shadow-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">{t.phoneLabel}</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0862944374"
                  required
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-[#1a56db] shadow-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-b from-[#4cff5e] to-[#1db02b] text-white font-bold text-lg rounded-2xl py-4 shadow-lg hover:brightness-110 transition-all disabled:opacity-50 mt-1"
              >
                {loading ? t.myMembershipSearching : t.myMembershipSearch}
              </button>
            </form>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm text-center">
                {error}
              </div>
            )}

            <p className="text-xs text-gray-400 text-center mt-5">{t.myMembershipMatchNote}</p>
          </>
        )}
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <Link href="/join" className="text-[#ffe033] font-semibold text-sm underline drop-shadow">
          {t.myMembershipNotMember}
        </Link>
        <Link href="/" className="text-white/60 text-sm underline drop-shadow">
          {t.myMembershipBack}
        </Link>
      </div>
    </div>
  );
}

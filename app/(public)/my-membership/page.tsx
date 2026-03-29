"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { translations, Lang } from "@/lib/i18n/translations";

export default function MyMembershipPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const t = translations[lang];

  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("ng_lang") as Lang | null;
    if (saved) setLang(saved);
  }, []);

  function handleLang(l: Lang) {
    setLang(l);
    localStorage.setItem("ng_lang", l);
  }

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
        setError(data.error ?? "Not found.");
      } else {
        router.push(`/qr/card/${data.id}`);
      }
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-5 py-10">

      {/* Language switcher */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher current={lang} onChange={handleLang} />
      </div>

      {/* Logo above the card */}
      <div className="mb-5">
        <Image
          src="/images/logo_small.png"
          alt="NinjaGym"
          width={100}
          height={100}
          className="drop-shadow-xl"
          priority
        />
      </div>

      {/* Frosted card */}
      <div className="w-full bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl px-6 py-8">
        <h1 className="font-fredoka text-3xl text-center text-[#1a56db] mb-1">
          {t.myMembershipTitle}
        </h1>
        <p className="text-gray-500 text-sm text-center mb-6">
          {t.myMembershipSubtitle}
        </p>

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

        <p className="text-xs text-gray-400 text-center mt-5">
          {t.myMembershipMatchNote}
        </p>
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

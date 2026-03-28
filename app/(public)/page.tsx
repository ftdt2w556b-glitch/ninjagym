"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { translations, Lang } from "@/lib/i18n/translations";

export default function HomePage() {
  const [lang, setLang] = useState<Lang>("en");
  const t = translations[lang];

  useEffect(() => {
    const saved = localStorage.getItem("ng_lang") as Lang | null;
    if (saved) setLang(saved);
  }, []);

  function handleLang(l: Lang) {
    setLang(l);
    localStorage.setItem("ng_lang", l);
  }

  return (
    <main className="relative flex flex-col items-center min-h-dvh px-4 py-8 text-white overflow-hidden">

      {/* Stars background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 3 + 1 + "px",
              height: Math.random() * 3 + 1 + "px",
              top: Math.random() * 60 + "%",
              left: Math.random() * 100 + "%",
              opacity: Math.random() * 0.6 + 0.2,
              animation: `twinkle ${Math.random() * 3 + 2}s ease-in-out infinite`,
              animationDelay: Math.random() * 3 + "s",
            }}
          />
        ))}
      </div>

      {/* Language switcher */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher current={lang} onChange={handleLang} />
      </div>

      {/* Logo */}
      <div className="mt-2 mb-1">
        <Image
          src="/images/logo_small.png"
          alt="NinjaGym Logo"
          width={120}
          height={120}
          className="drop-shadow-xl"
          priority
        />
      </div>

      {/* Title */}
      <h1 className="font-fredoka text-4xl text-center drop-shadow-lg leading-tight">
        RICK TEW&apos;S NINJAGYM
      </h1>
      <p className="font-bangers text-lg tracking-widest text-[#ffe033] text-center mt-1 drop-shadow">
        {t.homeSubtitle}
      </p>

      {/* Ninja hero image — floating animation */}
      <div className="my-4 relative z-10" style={{ animation: "floatNinja 4s ease-in-out infinite" }}>
        <Image
          src="/images/App1_small.png"
          alt="Ninja character"
          width={280}
          height={280}
          className="drop-shadow-2xl"
          priority
        />
      </div>

      {/* CTA buttons */}
      <div className="flex flex-col gap-3 w-full z-10">
        <Link
          href="/join"
          className="bg-gradient-to-b from-[#4cff5e] to-[#1db02b] text-white font-bold text-xl rounded-2xl py-4 text-center shadow-lg hover:brightness-110 transition-all active:scale-95"
        >
          🥷 {t.homeJoin}
        </Link>
        <Link
          href="/qr/card/me"
          className="border-2 border-white text-white font-bold text-base rounded-2xl py-3 text-center hover:bg-white/10 transition-all active:scale-95"
        >
          {t.homeMyMembership}
        </Link>

        {/* Secondary nav grid */}
        <div className="grid grid-cols-4 gap-2 mt-1">
          <Link href="/about" className="bg-white/15 rounded-2xl p-2 flex flex-col items-center gap-1.5 hover:bg-white/25 transition-all active:scale-95">
            <Image src="/images/App3_small.png" alt="About" width={40} height={40} className="rounded-xl object-cover" />
            <span className="text-xs font-bold text-center leading-tight">About</span>
          </Link>
          <Link href="/birthdays" className="bg-white/15 rounded-2xl p-2 flex flex-col items-center gap-1.5 hover:bg-white/25 transition-all active:scale-95">
            <Image src="/images/App4_small.png" alt="Events" width={40} height={40} className="rounded-xl object-cover" />
            <span className="text-xs font-bold text-center leading-tight">Birthdays</span>
          </Link>
          <Link href="/daycamps" className="bg-white/15 rounded-2xl p-2 flex flex-col items-center gap-1.5 hover:bg-white/25 transition-all active:scale-95">
            <span className="text-3xl">🏕️</span>
            <span className="text-xs font-bold text-center leading-tight">Day Camp</span>
          </Link>
          <Link href="/shop" className="bg-white/15 rounded-2xl p-2 flex flex-col items-center gap-1.5 hover:bg-white/25 transition-all active:scale-95">
            <Image src="/images/App6_small.png" alt="Shop" width={40} height={40} className="rounded-xl object-cover" />
            <span className="text-xs font-bold text-center leading-tight">{t.homeShop}</span>
          </Link>
        </div>

        <Link
          href="/promptpay"
          className="bg-white/10 text-white/80 font-semibold text-sm rounded-2xl py-3 text-center hover:bg-white/20 transition-all"
        >
          📱 {t.homePromptPay}
        </Link>
      </div>

      {/* Staff login */}
      <div className="mt-6 mb-2">
        <Link href="/admin/dashboard" className="text-white/40 text-xs underline">
          {t.homeStaffLogin}
        </Link>
      </div>

      <style jsx global>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.4); }
        }
        @keyframes floatNinja {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
      `}</style>
    </main>
  );
}

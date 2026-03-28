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
    <main className="relative flex flex-col items-center min-h-dvh px-4 py-6 text-white overflow-hidden">

      {/* Stars background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 3 + 1 + "px",
              height: Math.random() * 3 + 1 + "px",
              top: Math.random() * 70 + "%",
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
      <div className="mt-2 mb-2">
        <Image
          src="/images/logo_small.png"
          alt="NinjaGym Logo"
          width={130}
          height={130}
          className="drop-shadow-xl"
          priority
        />
      </div>

      {/* Title — big bold yellow Bangers like the original app */}
      <h1
        className="font-bangers text-center leading-none text-[#ffe033] drop-shadow-lg"
        style={{ fontSize: "clamp(3rem, 14vw, 5.5rem)", textShadow: "2px 3px 0px rgba(0,0,0,0.35)" }}
      >
        RICK TEW&apos;S<br />NINJAGYM
      </h1>
      <p className="text-white text-base text-center mt-2 mb-1 font-semibold drop-shadow">
        {t.homeSubtitle}
      </p>

      {/* Ninja hero image */}
      <div className="relative z-10" style={{ animation: "floatNinja 4s ease-in-out infinite" }}>
        <Image
          src="/images/App1_small.png"
          alt="Ninja character"
          width={300}
          height={300}
          className="drop-shadow-2xl"
          priority
        />
      </div>

      {/* CTA buttons */}
      <div className="flex flex-col gap-3 w-full z-10 mt-1">

        {/* JOIN NOW — big pill button */}
        <Link
          href="/join"
          className="bg-gradient-to-b from-[#5dff70] to-[#18a828] text-white font-bangers text-4xl rounded-full py-3 text-center shadow-xl hover:brightness-110 transition-all active:scale-95 tracking-wider"
          style={{ textShadow: "1px 2px 0px rgba(0,0,0,0.3)" }}
        >
          JOIN NOW
        </Link>

        {/* MY MEMBERSHIP */}
        <Link
          href="/my-membership"
          className="bg-[#0d2d1a] border border-white/20 text-white font-bold text-base rounded-full py-3.5 text-center hover:bg-[#133d24] transition-all active:scale-95 tracking-wide"
        >
          {t.homeMyMembership}
        </Link>

        {/* Secondary nav grid */}
        <div className="grid grid-cols-3 gap-2 mt-1">
          <Link href="/about" className="bg-white/15 rounded-2xl p-3 flex flex-col items-center gap-1.5 hover:bg-white/25 transition-all active:scale-95">
            <Image src="/images/App3_small.png" alt="About" width={44} height={44} className="rounded-xl object-cover" />
            <span className="text-xs font-bold text-center leading-tight">About</span>
          </Link>
          <Link href="/birthdays" className="bg-white/15 rounded-2xl p-3 flex flex-col items-center gap-1.5 hover:bg-white/25 transition-all active:scale-95">
            <Image src="/images/App4_small.png" alt="Birthdays" width={44} height={44} className="rounded-xl object-cover" />
            <span className="text-xs font-bold text-center leading-tight">Birthdays</span>
          </Link>
          <Link href="/shop" className="bg-white/15 rounded-2xl p-3 flex flex-col items-center gap-1.5 hover:bg-white/25 transition-all active:scale-95">
            <Image src="/images/App6_small.png" alt="Shop" width={44} height={44} className="rounded-xl object-cover" />
            <span className="text-xs font-bold text-center leading-tight">{t.homeShop}</span>
          </Link>
        </div>

        {/* Bottom utility links */}
        <Link
          href="/contact"
          className="bg-white/10 text-white/80 font-semibold text-sm rounded-2xl py-3 text-center hover:bg-white/20 transition-all"
        >
          ✉️ Contact Us
        </Link>
      </div>

      {/* Staff login */}
      <div className="mt-5 mb-2">
        <Link href="/admin/dashboard" className="text-white/30 text-xs underline">
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
          50% { transform: translateY(-12px); }
        }
      `}</style>
    </main>
  );
}

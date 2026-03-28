"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { translations, Lang } from "@/lib/i18n/translations";

// Fixed star positions so they don't re-randomise on re-render
const TWINKLE_STARS = Array.from({ length: 28 }, (_, i) => ({
  width:  (((i * 37 + 13) % 3) + 1) + "px",
  height: (((i * 37 + 13) % 3) + 1) + "px",
  top:    ((i * 71 + 17) % 70) + "%",
  left:   ((i * 53 + 29) % 100) + "%",
  opacity: (((i * 19 + 7) % 6) + 2) / 10,
  duration: (((i * 23 + 11) % 3) + 2) + "s",
  delay:    (((i * 31 + 5) % 30) / 10) + "s",
}));

// Yellow star decorations behind the ninja
const YELLOW_STARS = [
  { top: "9%",  left: "6%",  size: "2rem",  delay: "0s",    duration: "2.2s", char: "⭐" },
  { top: "6%",  right: "13%", size: "1.4rem", delay: "0.7s", duration: "2.8s", char: "✦", color: "#ffe033" },
  { top: "38%", left: "3%",  size: "1.1rem", delay: "1.3s", duration: "2.5s", char: "✦", color: "#ffe033" },
  { top: "28%", right: "5%", size: "1.8rem", delay: "0.3s", duration: "3s",   char: "⭐" },
  { bottom: "22%", left: "9%", size: "1rem",  delay: "1s",   duration: "2s",   char: "✦", color: "#ffe033" },
  { top: "55%", right: "8%", size: "1.2rem", delay: "0.5s", duration: "2.6s", char: "✦", color: "#ffe033" },
];

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

      {/* Small white twinkle dots background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {TWINKLE_STARS.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: s.width, height: s.height,
              top: s.top, left: s.left,
              opacity: s.opacity,
              animation: `twinkle ${s.duration} ease-in-out infinite`,
              animationDelay: s.delay,
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

      {/* Title */}
      <h1
        className="font-bangers text-center leading-none text-[#ffe033] drop-shadow-lg"
        style={{ fontSize: "clamp(3rem, 14vw, 5.5rem)", textShadow: "2px 3px 0px rgba(0,0,0,0.35)" }}
      >
        RICK TEW&apos;S<br />NINJAGYM
      </h1>

      {/* Subtitle — no z-index so ninja (z-10) renders on top of it */}
      <p className="text-white text-base text-center mb-0 mt-2 font-semibold drop-shadow">
        {t.homeSubtitle}
      </p>

      {/*
        Ninja hero + yellow pulsating stars
        pointer-events-none so touches pass through to the Join button below
        marginTop: -35px pulls ninja up so it overlaps the subtitle text
        marginBottom: -40px lets feet just peek over the Join button top edge
      */}
      <div
        className="relative w-full flex justify-center pointer-events-none"
        style={{ marginTop: "-35px", marginBottom: "-40px", zIndex: 10 }}
      >
        {/* Yellow stars — behind the ninja (zIndex 1) */}
        {YELLOW_STARS.map((s, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              top: s.top,
              left: (s as { left?: string }).left,
              right: (s as { right?: string }).right,
              bottom: (s as { bottom?: string }).bottom,
              fontSize: s.size,
              color: (s as { color?: string }).color,
              zIndex: 1,
              animation: `starPop ${s.duration} ease-in-out infinite`,
              animationDelay: s.delay,
              lineHeight: 1,
            }}
          >
            {s.char}
          </span>
        ))}

        {/* Ninja image — above stars (zIndex 2) */}
        <div style={{ animation: "floatNinja 4s ease-in-out infinite", position: "relative", zIndex: 2 }}>
          <Image
            src="/images/App1_small.png"
            alt="Ninja character"
            width={340}
            height={340}
            className="drop-shadow-2xl"
            priority
          />
        </div>
      </div>

      {/* CTA buttons — zIndex 5 so they sit above the ninja's bottom overlap */}
      <div className="flex flex-col gap-3 w-full relative" style={{ zIndex: 5 }}>

        {/* JOIN NOW — main pill button */}
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
        @keyframes starPop {
          0%, 100% { opacity: 0.45; transform: scale(0.82); }
          50% { opacity: 1; transform: scale(1.22); }
        }
      `}</style>
    </main>
  );
}

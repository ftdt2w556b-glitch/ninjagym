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

// Words that light up one by one, then "Play like a Ninja!!" all at once
const HERO_WORDS = [
  { word: "Run",   stage: 1 },
  { word: "Jump",  stage: 2 },
  { word: "Kick",  stage: 3 },
  { word: "Climb", stage: 4 },
];

export default function HomePage() {
  const [lang, setLang] = useState<Lang>("en");
  const t = translations[lang];
  const [litStage, setLitStage] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("ng_lang") as Lang | null;
    if (saved) setLang(saved);

    // Word-by-word light-up: Run → Jump → Kick → Climb → Play like a Ninja!!
    const timers = [
      setTimeout(() => setLitStage(1), 600),
      setTimeout(() => setLitStage(2), 1200),
      setTimeout(() => setLitStage(3), 1800),
      setTimeout(() => setLitStage(4), 2400),
      setTimeout(() => setLitStage(5), 3300),
    ];
    return () => timers.forEach(clearTimeout);
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

      {/* Logo — large enough to read "Rick Tew's" text on it */}
      <div className="mt-2 mb-3">
        <Image
          src="/images/logo_small.png"
          alt="NinjaGym Logo"
          width={210}
          height={210}
          className="drop-shadow-xl"
          priority
        />
      </div>

      {/* Animated headline — words light up one by one then stay yellow */}
      <div
        className="font-fredoka font-bold text-center drop-shadow-lg mb-2 select-none"
        style={{ fontSize: "clamp(1.5rem, 6.5vw, 2.1rem)", textShadow: "1px 2px 0px rgba(0,0,0,0.45)", lineHeight: 1.25 }}
      >
        {/* Line 1: Run, Jump, Kick, Climb, and... */}
        <div>
          {HERO_WORDS.map(({ word, stage }, i) => (
            <span key={word}>
              <span style={{
                color: litStage >= stage ? "#ffe033" : "rgba(255,255,255,0.85)",
                transition: "color 0.45s ease",
              }}>
                {word}
              </span>
              {i < HERO_WORDS.length - 1
                ? <span style={{ color: "rgba(255,255,255,0.6)" }}>, </span>
                : <span style={{ color: litStage >= 4 ? "#ffe033" : "rgba(255,255,255,0.55)", transition: "color 0.45s ease" }}>, and…</span>
              }
            </span>
          ))}
        </div>
        {/* Line 2: Play like a Ninja!! — all lights up together */}
        <div style={{
          color: litStage >= 5 ? "#ffe033" : "rgba(255,255,255,0.85)",
          transition: "color 0.55s ease",
        }}>
          Play like a Ninja!!
        </div>
      </div>

      {/*
        Ninja hero + yellow pulsating stars.
        marginTop: -15px nudges him slightly higher without covering text at load.
        The float animation (+12px up at peak) may graze the subtitle's bottom
        edge but the starting position is safely below.
        marginBottom: -40px lets feet just peek over the Join button top edge.
      */}
      <div
        className="relative w-full flex justify-center pointer-events-none"
        style={{ marginTop: "-18px", marginBottom: "-42px", zIndex: 10 }}
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
            width={300}
            height={300}
            className="drop-shadow-2xl"
            priority
          />
        </div>
      </div>

      {/* CTA buttons — mt-3 gives breathing room below ninja; zIndex 5 */}
      <div className="flex flex-col gap-3 w-full relative mt-3" style={{ zIndex: 5 }}>

        {/* JOIN NOW — trampoline glow synced with ninja float (4s) */}
        <Link
          href="/join"
          className="bg-gradient-to-b from-[#5dff70] to-[#18a828] text-white font-bangers text-4xl rounded-full py-3 text-center shadow-xl active:scale-95 tracking-wider"
          style={{
            textShadow: "1px 2px 0px rgba(0,0,0,0.3)",
            animation: "trampolineGlow 4s ease-in-out infinite",
          }}
        >
          {t.homeJoinBtn}
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
          <Link href="/about" className="bg-white/15 rounded-2xl py-4 px-2 flex flex-col items-center gap-2 hover:bg-white/25 transition-all active:scale-95">
            <Image src="/images/App3_small.png" alt="About" width={72} height={72} className="rounded-xl object-cover" />
            <span className="text-xs font-bold text-center leading-tight">{t.homeAbout}</span>
          </Link>
          <Link href="/birthdays" className="bg-white/15 rounded-2xl py-4 px-2 flex flex-col items-center gap-2 hover:bg-white/25 transition-all active:scale-95">
            <Image src="/images/App4_small.png" alt="Birthdays" width={72} height={72} className="rounded-xl object-cover" />
            <span className="text-xs font-bold text-center leading-tight">{t.homeBirthdays}</span>
          </Link>
          <Link href="/shop" className="bg-white/15 rounded-2xl py-4 px-2 flex flex-col items-center gap-2 hover:bg-white/25 transition-all active:scale-95">
            <Image src="/images/App6_small.png" alt="Shop" width={72} height={72} className="rounded-xl object-cover" />
            <span className="text-xs font-bold text-center leading-tight">{t.homeShop}</span>
          </Link>
        </div>

        {/* Bottom utility links */}
        <Link
          href="/contact"
          className="bg-white/10 text-white/80 font-semibold text-sm rounded-2xl py-3 text-center hover:bg-white/20 transition-all"
        >
          ✉️ {t.homeContactUs}
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
        /* Button brightens when ninja is at lowest point (0%/100%) — trampoline */
        @keyframes trampolineGlow {
          0%, 100% { filter: brightness(1.25) saturate(1.15); box-shadow: 0 0 18px rgba(93,255,112,0.55); }
          40%, 60% { filter: brightness(1)    saturate(1);    box-shadow: 0 4px 14px rgba(0,0,0,0.25); }
        }
        @keyframes starPop {
          0%, 100% { opacity: 0.45; transform: scale(0.82); }
          50% { opacity: 1; transform: scale(1.22); }
        }
      `}</style>
    </main>
  );
}

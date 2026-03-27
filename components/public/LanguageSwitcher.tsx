"use client";

import { Lang } from "@/lib/i18n/translations";

const FLAGS: { lang: Lang; flag: string; label: string }[] = [
  { lang: "en", flag: "🇬🇧", label: "EN" },
  { lang: "ru", flag: "🇷🇺", label: "RU" },
  { lang: "th", flag: "🇹🇭", label: "TH" },
];

export default function LanguageSwitcher({
  current,
  onChange,
}: {
  current: Lang;
  onChange: (lang: Lang) => void;
}) {
  return (
    <div className="flex gap-1">
      {FLAGS.map(({ lang, flag, label }) => (
        <button
          key={lang}
          onClick={() => onChange(lang)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-semibold transition-colors ${
            current === lang
              ? "bg-white text-[#1a56db]"
              : "bg-white/20 text-white hover:bg-white/30"
          }`}
        >
          <span>{flag}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

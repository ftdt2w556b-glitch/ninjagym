"use client";

import { Lang, LANGUAGES } from "@/lib/i18n/translations";

export default function LanguageSwitcher({
  current,
  onChange,
}: {
  current: Lang;
  onChange: (lang: Lang) => void;
}) {
  const selected = LANGUAGES.find((l) => l.code === current);

  return (
    <div className="relative">
      <select
        value={current}
        onChange={(e) => onChange(e.target.value as Lang)}
        className="appearance-none bg-white/20 text-white font-semibold text-sm rounded-xl pl-3 pr-7 py-1.5 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer hover:bg-white/30 transition-colors"
        style={{ WebkitAppearance: "none" }}
      >
        {LANGUAGES.map(({ code, label, flag }) => (
          <option key={code} value={code} className="text-gray-800 bg-white">
            {flag} {label}
          </option>
        ))}
      </select>
      {/* Custom dropdown arrow */}
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/70 text-xs">
        ▾
      </span>
    </div>
  );
}

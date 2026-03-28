"use client";

import { useState, useRef, useEffect } from "react";
import { Lang, LANGUAGES } from "@/lib/i18n/translations";

export default function LanguageSwitcher({
  current,
  onChange,
}: {
  current: Lang;
  onChange: (lang: Lang) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = LANGUAGES.find((l) => l.code === current) ?? LANGUAGES[0];

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative z-50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 border border-white/30 text-white rounded-xl px-2.5 py-1.5 transition-colors"
        aria-label="Select language"
      >
        <span className="text-xl leading-none">{selected.flag}</span>
        <span className="text-white/60 text-xs leading-none">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden min-w-[160px]">
          {LANGUAGES.map(({ code, label, flag }) => (
            <button
              key={code}
              onClick={() => { onChange(code); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${
                current === code
                  ? "bg-blue-50 text-[#1a56db] font-bold"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="text-base">{flag}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

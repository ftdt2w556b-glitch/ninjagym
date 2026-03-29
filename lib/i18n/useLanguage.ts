"use client";
import { useState, useEffect } from "react";
import { Lang, translations } from "./translations";

/** Reads lang from localStorage and returns t + lang. Safe for SSR (defaults to "en"). */
export function useLanguage() {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("ng_lang") as Lang | null;
    if (saved && saved in translations) setLang(saved);
  }, []);

  return { lang, t: translations[lang] };
}

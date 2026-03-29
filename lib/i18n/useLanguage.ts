"use client";
import { useState, useEffect, useCallback } from "react";
import { Lang, translations } from "./translations";

/** Reads lang from localStorage and returns t, lang, and a setLang that persists. Safe for SSR (defaults to "en"). */
export function useLanguage() {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("ng_lang") as Lang | null;
    if (saved && saved in translations) setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("ng_lang", l);
  }, []);

  return { lang, t: translations[lang], setLang };
}

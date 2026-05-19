"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n/translations";

/**
 * Small text-only footer with privacy + terms links. Mounted at the
 * bottom of every public page that collects data (join, shop,
 * birthdays, my-membership) plus the homepage. Translates the labels
 * to Thai when the parent's saved language is th; falls back to
 * English for the other four (ru/fr/he) until those legal pages get
 * translated too.
 */
export default function LegalFooter() {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const saved = localStorage.getItem("ng_lang") as Lang | null;
    if (saved) setLang(saved);
  }, []);

  const isTh = lang === "th";
  const privacyLabel = isTh ? "นโยบายความเป็นส่วนตัว" : "Privacy";
  const termsLabel   = isTh ? "เงื่อนไข"            : "Terms";
  const contactLabel = isTh ? "ติดต่อ"               : "Contact";

  return (
    <footer className="mt-10 mb-4 text-center">
      <div className="flex items-center justify-center gap-3 text-xs text-white/60">
        <Link href="/policy"  className="hover:text-white transition-colors">{privacyLabel}</Link>
        <span aria-hidden>·</span>
        <Link href="/terms"   className="hover:text-white transition-colors">{termsLabel}</Link>
        <span aria-hidden>·</span>
        <Link href="/contact" className="hover:text-white transition-colors">{contactLabel}</Link>
      </div>
      <p className="text-[10px] text-white/40 mt-2">
        © NinjaGym Samui · Big C Mall, Bophut
      </p>
    </footer>
  );
}

"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/useLanguage";

interface ShareButtonProps {
  url: string;
  title: string;
}

export default function ShareButton({ url, title }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const { t } = useLanguage();

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User cancelled share or not supported
      }
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore
    }
  }

  return (
    <button
      onClick={handleShare}
      className="w-full bg-[#1a56db] text-white font-bold py-3 rounded-2xl hover:bg-blue-600 transition-colors mt-4 shadow"
    >
      {copied ? t.shareCopied : t.shareCard}
    </button>
  );
}

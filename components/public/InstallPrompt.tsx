"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/useLanguage";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const { t } = useLanguage();
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isIOSSafari, setIsIOSSafari] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Don't show if dismissed this session
    if (sessionStorage.getItem("pwa-dismissed")) return;

    // iOS detection
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as Record<string, unknown>).MSStream;
    if (ios) {
      // Detect if running in Safari specifically (not Chrome/Firefox on iOS)
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      setIsIOS(true);
      setIsIOSSafari(isSafari);
      setTimeout(() => setShow(true), 3000);
      return;
    }

    // Android/Chrome — native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 3000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    sessionStorage.setItem("pwa-dismissed", "1");
    setShow(false);
    setDismissed(true);
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setShow(false);
    else dismiss();
  }

  if (!show || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-[#1a56db] rounded-2xl shadow-2xl p-4 text-white">
        <div className="flex items-start gap-3">
          {/* NinjaGym PWA icon */}
          <div className="shrink-0 w-12 h-12 rounded-xl overflow-hidden shadow-md">
            <Image
              src="/icons/icon-192.png"
              alt="NinjaGym"
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1">
            <p className="font-bold text-sm">{t.installTitle}</p>
            {isIOS ? (
              isIOSSafari ? (
                /* Safari on iOS — can install via Share sheet */
                <p className="text-xs text-white/80 mt-0.5">
                  Tap <strong>Share ↑</strong> then <strong>Add to Home Screen</strong> to save your card.
                </p>
              ) : (
                /* Chrome / Firefox on iOS — must switch to Safari */
                <p className="text-xs text-white/80 mt-0.5">
                  Open this page in <strong>Safari</strong> to add NinjaGym to your home screen.
                </p>
              )
            ) : (
              /* Android / Chrome / Edge — native install prompt */
              <p className="text-xs text-white/80 mt-0.5">{t.installHint}</p>
            )}
          </div>

          <button onClick={dismiss} className="text-white/60 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Show install button on Android/Chrome only (native prompt) */}
        {!isIOS && (
          <button
            onClick={install}
            className="mt-3 w-full bg-white text-[#1a56db] font-bold py-2 rounded-xl text-sm hover:bg-blue-50 transition-colors"
          >
            {t.installBtn}
          </button>
        )}
      </div>
    </div>
  );
}

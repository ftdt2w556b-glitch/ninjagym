"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Don't show if dismissed this session
    if (sessionStorage.getItem("pwa-dismissed")) return;

    // iOS detection
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as Record<string, unknown>).MSStream;
    if (ios) {
      setIsIOS(true);
      setTimeout(() => setShow(true), 3000);
      return;
    }

    // Android/Chrome
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
          <span className="text-2xl">🥷</span>
          <div className="flex-1">
            <p className="font-bold text-sm">Install NinjaGym App</p>
            {isIOS ? (
              <p className="text-xs text-white/80 mt-0.5">
                Tap <strong>Share</strong> then <strong>Add to Home Screen</strong> for quick QR check-in access.
              </p>
            ) : (
              <p className="text-xs text-white/80 mt-0.5">
                Install for quick QR check-in access — works offline too.
              </p>
            )}
          </div>
          <button onClick={dismiss} className="text-white/60 hover:text-white text-lg leading-none">✕</button>
        </div>
        {!isIOS && (
          <button
            onClick={install}
            className="mt-3 w-full bg-white text-[#1a56db] font-bold py-2 rounded-xl text-sm hover:bg-blue-50 transition-colors"
          >
            Install App
          </button>
        )}
      </div>
    </div>
  );
}

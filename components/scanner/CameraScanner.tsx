"use client";

import { useEffect, useRef } from "react";

interface Props {
  onScan: (memberId: string) => void;
  onClose: () => void;
}

export default function CameraScanner({ onScan, onClose }: Props) {
  const divId = "qr-camera-region";
  const scannerRef = useRef<unknown>(null);
  const hasScanned = useRef(false);

  useEffect(() => {
    let scanner: { stop: () => Promise<void> } | null = null;

    async function start() {
      const { Html5Qrcode } = await import("html5-qrcode");
      scanner = new Html5Qrcode(divId);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" }, // rear camera
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText: string) => {
            if (hasScanned.current) return;
            hasScanned.current = true;

            // QR value is either:
            //   https://ninjagym.com/scanner?member=42   (from member QR card)
            //   or just a plain number
            let memberId = decodedText.trim();
            try {
              const url = new URL(decodedText);
              const param = url.searchParams.get("member");
              if (param) memberId = param;
            } catch {
              // not a URL — use raw value
            }

            onScan(memberId);
            scanner?.stop().catch(() => null);
          },
          () => null // ignore per-frame errors
        );
      } catch (err) {
        console.error("Camera start failed:", err);
      }
    }

    start();

    return () => {
      scanner?.stop().catch(() => null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4">
      {/* Header */}
      <div className="w-full max-w-sm flex items-center justify-between mb-4">
        <p className="text-white font-semibold text-lg">Scan Member QR Code</p>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-2xl leading-none px-2"
        >
          ✕
        </button>
      </div>

      {/* Camera viewport */}
      <div className="w-full max-w-sm rounded-2xl overflow-hidden bg-gray-900 relative">
        <div id={divId} className="w-full" />

        {/* Scan frame overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-48 h-48 border-2 border-white/60 rounded-xl relative">
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-[#ffe033] rounded-tl-sm" />
            <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-[#ffe033] rounded-tr-sm" />
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-[#ffe033] rounded-bl-sm" />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-[#ffe033] rounded-br-sm" />
          </div>
        </div>
      </div>

      <p className="text-gray-400 text-sm mt-4 text-center">
        Point the camera at the member&apos;s QR code
      </p>
      <p className="text-gray-600 text-xs mt-1 text-center">
        Works on phones, tablets, and laptops with a webcam
      </p>
    </div>
  );
}

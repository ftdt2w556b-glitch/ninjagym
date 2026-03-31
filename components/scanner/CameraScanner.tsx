"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  onScan: (memberId: string) => void;
  onClose: () => void;
}

export default function CameraScanner({ onScan, onClose }: Props) {
  const divId = "qr-camera-region";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const hasScanned = useRef(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [starting, setStarting] = useState(false);

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    setStarting(true);

    // Stop any existing scanner first
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
      scannerRef.current = null;
    }

    // Clear the div so html5-qrcode can re-initialise it
    const el = document.getElementById(divId);
    if (el) el.innerHTML = "";

    const { Html5Qrcode } = await import("html5-qrcode");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scanner: any = new Html5Qrcode(divId);
    scannerRef.current = scanner;
    hasScanned.current = false;

    try {
      await scanner.start(
        { facingMode: facing },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText: string) => {
          if (hasScanned.current) return;
          hasScanned.current = true;

          // QR value is either a full URL (/scanner?member=42) or a plain number
          let memberId = decodedText.trim();
          try {
            const url = new URL(decodedText);
            const param = url.searchParams.get("member");
            if (param) memberId = param;
          } catch {
            // not a URL — use raw value
          }

          onScan(memberId);
          scanner.stop().catch(() => null);
        },
        () => null // ignore per-frame errors
      );
    } catch (err) {
      console.error("Camera start failed:", err);
    } finally {
      setStarting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onScan]);

  // Start on mount
  useEffect(() => {
    startCamera("environment");
    return () => {
      scannerRef.current?.stop().catch(() => null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function flipCamera() {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    await startCamera(next);
  }

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

      {/* Flip camera button */}
      <button
        onClick={flipCamera}
        disabled={starting}
        className="mt-4 flex items-center gap-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all active:scale-95"
      >
        <span className="text-lg">🔄</span>
        {facingMode === "environment" ? "Switch to Front Camera" : "Switch to Rear Camera"}
      </button>

    </div>
  );
}

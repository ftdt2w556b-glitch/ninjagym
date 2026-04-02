"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckInButton({
  regId,
  label,
  sessionsRemaining,
  staffName,
  kidsCount = 1,
}: {
  regId: number;
  label: string;
  sessionsRemaining?: number | null;
  staffName?: string;
  kidsCount?: number;
}) {
  const router = useRouter();
  const [step, setStep]         = useState<"idle" | "confirm">("idle");
  const [kidsToday, setKidsToday] = useState(kidsCount);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<"ok" | "warn" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleClick() {
    setKidsToday(kidsCount); // reset to registered default
    setErrorMsg(null);
    setStep("confirm");
  }

  async function handleConfirm() {
    setLoading(true);
    setErrorMsg(null);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_id: regId,
        note: `Check-in by ${staffName ?? "Staff"}`,
        kids_count_override: kidsToday,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setResult(data.outOfSessions ? "warn" : "ok");
      setStep("idle");
      router.refresh();
    } else {
      setErrorMsg(data.error ?? "Check-in failed");
      setStep("idle");
    }
  }

  if (result === "ok")   return <span className="text-xs text-green-600 font-semibold">✓ Checked in</span>;
  if (result === "warn") return <span className="text-xs text-orange-500 font-semibold">✓ Checked in (0 left)</span>;

  if (step === "confirm") {
    return (
      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
        {/* Kids today adjuster — only shown when registered count > 1 */}
        {kidsCount > 1 && (
          <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
            <button
              type="button"
              onClick={() => setKidsToday(Math.max(1, kidsToday - 1))}
              className="text-blue-500 hover:text-blue-800 font-bold leading-none w-4 text-center"
            >−</button>
            <span className="text-xs font-bold text-blue-700 w-12 text-center">
              {kidsToday} kid{kidsToday !== 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={() => setKidsToday(Math.min(10, kidsToday + 1))}
              className="text-blue-500 hover:text-blue-800 font-bold leading-none w-4 text-center"
            >+</button>
          </div>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className="text-xs bg-[#1a56db] text-white font-semibold px-2.5 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setStep("idle")}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
        {errorMsg && (
          <span className="text-xs text-red-500 leading-tight">{errorMsg}</span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`text-xs underline disabled:opacity-40 whitespace-nowrap ${
        sessionsRemaining === 0
          ? "text-orange-400 hover:text-orange-600"
          : "text-gray-400 hover:text-[#1a56db]"
      }`}
    >
      {sessionsRemaining === 0 ? "Check In (0 left)" : "Check In"}
    </button>
  );
}

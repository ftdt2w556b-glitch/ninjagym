"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckInButton({
  regId,
  label,
  sessionsRemaining,
  staffName,
}: {
  regId: number;
  label: string;
  sessionsRemaining?: number | null;
  staffName?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"ok" | "warn" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleCheckIn() {
    const noSessions = sessionsRemaining !== undefined && sessionsRemaining !== null && sessionsRemaining === 0;
    const msg = noSessions
      ? `No sessions remaining for "${label}". Check in anyway?`
      : `Check in "${label}"?`;
    if (!confirm(msg)) return;
    setLoading(true);
    setErrorMsg(null);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: regId, note: `Check-in by ${staffName ?? "Staff"}` }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setResult(data.outOfSessions ? "warn" : "ok");
      router.refresh();
    } else {
      setErrorMsg(data.error ?? "Check-in failed");
    }
  }

  if (result === "ok") return <span className="text-xs text-green-600 font-semibold">Checked in</span>;
  if (result === "warn") return <span className="text-xs text-orange-500 font-semibold">Checked in (0 sessions left)</span>;
  if (errorMsg) return <span className="text-xs text-red-500 font-semibold max-w-[180px] leading-tight">{errorMsg}</span>;

  return (
    <button
      onClick={handleCheckIn}
      disabled={loading}
      className={`text-xs underline disabled:opacity-40 whitespace-nowrap ${
        sessionsRemaining === 0
          ? "text-orange-400 hover:text-orange-600"
          : "text-gray-400 hover:text-[#1a56db]"
      }`}
    >
      {loading ? "..." : sessionsRemaining === 0 ? "Check In (0 left)" : "Check In"}
    </button>
  );
}

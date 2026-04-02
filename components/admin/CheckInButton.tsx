"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckInButton({
  regId,
  label,
  sessionsRemaining,
}: {
  regId: number;
  label: string;
  sessionsRemaining?: number | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"ok" | "warn" | null>(null);

  async function handleCheckIn() {
    const noSessions = sessionsRemaining !== undefined && sessionsRemaining !== null && sessionsRemaining === 0;
    const msg = noSessions
      ? `No sessions remaining for "${label}". Check in anyway?`
      : `Check in "${label}"?`;
    if (!confirm(msg)) return;
    setLoading(true);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: regId, note: "Manual check-in by staff" }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setResult(data.outOfSessions ? "warn" : "ok");
      router.refresh();
    }
  }

  if (result === "ok") return <span className="text-xs text-green-600 font-semibold">Checked in</span>;
  if (result === "warn") return <span className="text-xs text-orange-500 font-semibold">Checked in (0 sessions left)</span>;

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

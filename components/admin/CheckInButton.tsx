"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckInButton({
  regId,
  label,
}: {
  regId: number;
  label: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleCheckIn() {
    if (!confirm(`Mark "${label}" as used and record attendance?`)) return;
    setLoading(true);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: regId, note: "Manual check-in by staff" }),
    });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      router.refresh();
    }
  }

  if (done) return <span className="text-xs text-green-600 font-semibold">Checked in</span>;

  return (
    <button
      onClick={handleCheckIn}
      disabled={loading}
      className="text-xs text-gray-400 hover:text-[#1a56db] underline disabled:opacity-40 whitespace-nowrap"
    >
      {loading ? "..." : "Check In"}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Delete button for an event booking. Used on the edit page, admin/owner only.
 * Two-step confirm so a stray click never wipes a booking + its cash sale row.
 */
export default function DeleteEventButton({ bookingId }: { bookingId: number }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function doDelete() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/event-bookings/${bookingId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Delete failed");
      }
      router.push("/admin/event-bookings");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="bg-red-100 text-red-700 font-semibold px-4 py-2.5 rounded-xl hover:bg-red-200 transition-colors"
      >
        🗑 Delete Booking
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-bold text-red-700">Permanently delete?</span>
      <button
        type="button"
        onClick={doDelete}
        disabled={busy}
        className="bg-red-500 text-white font-bold px-4 py-2 rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors"
      >
        {busy ? "Deleting..." : "Yes, delete"}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        disabled={busy}
        className="text-gray-500 px-3 py-2 rounded-xl hover:bg-gray-100 font-medium"
      >
        Cancel
      </button>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}

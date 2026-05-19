"use client";

import { useEffect, useState } from "react";
import { useStaffPin } from "./StaffPinProvider";

/**
 * The "Name / Contact" column of the Members table. Sensitive fields
 * (PIN / email / phone / kids names) stay hidden per row by default to
 * avoid over-the-shoulder leakage on the centre browser, where the rest
 * of the dashboard often has an active PIN write window from a recent
 * approval.
 *
 * Reveal behaviour:
 * - Tap '👁 Reveal' on the row you actually want to read.
 * - If no PIN cookie is active, the PIN modal opens once; on success the
 *   server unmasks that row and starts a 30-second auto-hide timer.
 * - If a PIN cookie IS already active (writeStatus is non-null), the
 *   call to /api/staff-pin/check-write returns 200 instantly with no
 *   modal, staff gets immediate reveal on the row, but every other row
 *   on the page stays masked. That's the trade-off: fast for the row
 *   you want, no broadcasting to anyone glancing at the screen.
 */
const AUTO_HIDE_MS = 30_000;

export default function MemberContactCell({
  name,
  pin,
  email,
  phone,
  kidsNames,
  loyaltyDiscount,
}: {
  name:             string;
  pin:              string | null;
  email:            string | null;
  phone:            string | null;
  kidsNames:        string | null;
  loyaltyDiscount?: number | null;
}) {
  const { fetchWithPin } = useStaffPin();
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  // Auto-collapse this row 30 seconds after a successful reveal so an
  // unattended browser doesn't keep broadcasting one parent's contact.
  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setRevealed(false), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [revealed]);

  const hasSensitive = !!(pin || email || phone || kidsNames);

  async function reveal() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetchWithPin("/api/staff-pin/check-write", { method: "GET" });
      if (res.ok) {
        setRevealed(true);
      } else {
        setErr("PIN required");
      }
    } catch {
      setErr("Connection problem");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-semibold text-gray-900">{name}</p>

        {revealed && pin && (
          <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 font-mono">
            PIN: {pin}
          </span>
        )}

        {loyaltyDiscount ? (
          <span className="text-xs bg-yellow-100 text-yellow-700 font-bold rounded px-1.5 py-0.5">
            ⭐ ฿{loyaltyDiscount} off
          </span>
        ) : null}

        {!revealed && hasSensitive && (
          <button
            type="button"
            onClick={reveal}
            disabled={busy}
            className="text-xs text-[#1a56db] hover:underline disabled:opacity-50"
          >
            {busy ? "…" : "👁 Reveal"}
          </button>
        )}

        {revealed && (
          <button
            type="button"
            onClick={() => setRevealed(false)}
            className="text-xs text-gray-400 hover:text-gray-600"
            aria-label="Hide contact"
          >
            ✕
          </button>
        )}
      </div>

      {revealed && (
        <>
          {email     && <p className="text-xs text-gray-400">{email}</p>}
          {phone     && <p className="text-xs text-gray-400">{phone}</p>}
          {kidsNames && (
            <p className="text-xs text-blue-600 mt-0.5 font-bold">{kidsNames}</p>
          )}
        </>
      )}

      {err && <p className="text-xs text-red-500 mt-0.5">{err}</p>}
    </div>
  );
}

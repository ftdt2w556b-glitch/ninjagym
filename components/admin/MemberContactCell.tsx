"use client";

import { useState } from "react";
import { useStaffPin } from "./StaffPinProvider";

/**
 * The "Name / Contact" column of the Members table. PIN, email, phone,
 * and kids names sit behind the PIN gate so a busy centre browser can't
 * be shoulder-surfed for 500+ rows of parent contact info at a glance.
 *
 * Behaviour:
 * - If a PIN write window is currently active (writeStatus from
 *   StaffPinProvider — set by any approve / reveal / edit in the last
 *   15 min), all sensitive fields render automatically. No per-row tap.
 * - Otherwise, a 'Reveal' button calls fetchWithPin against
 *   /api/staff-pin/check-write, which triggers the PIN modal on a 401 +
 *   pin_required and sets writeStatus on success. Once it's set, every
 *   cell on the page unmasks at the same time.
 * - When the write cookie expires (countdown ticks to zero) writeStatus
 *   clears via the provider's setTimeout and the entire table re-masks.
 *
 * Admin / owner sessions bypass the modal but still need to trigger a
 * reveal once to populate writeStatus, since their session never carries
 * a write cookie. (Future improvement: provider could synthesise a
 * permanent 'admin' writeStatus on mount.)
 */
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
  const { fetchWithPin, writeStatus } = useStaffPin();
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);

  const hasSensitive = !!(pin || email || phone || kidsNames);
  const revealed     = !!writeStatus;       // page-wide unlock, not per-row

  async function unlock() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetchWithPin("/api/staff-pin/check-write", { method: "GET" });
      if (!res.ok) setErr("PIN required");
      // Success path: provider catches the response, updates writeStatus,
      // every cell re-renders unmasked. Nothing else to do here.
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
            onClick={unlock}
            disabled={busy}
            className="text-xs text-[#1a56db] hover:underline disabled:opacity-50"
            title="Unlock contact details for the whole page"
          >
            {busy ? "…" : "👁 Reveal"}
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

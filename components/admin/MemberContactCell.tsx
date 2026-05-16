"use client";

import { useEffect, useState } from "react";
import { useStaffPin } from "./StaffPinProvider";

/**
 * The "Name / Contact" column of the Members table. Hides PIN, email,
 * phone, and kids names behind a tap-to-reveal so the centre device
 * can't be casually shoulder-surfed for 500+ rows of parent contact
 * info.
 *
 * Reveal flow:
 *  1. Staff taps the eye button.
 *  2. fetchWithPin GETs /api/staff-pin/check-write. If the write cookie
 *     is missing/expired, the PIN modal opens; on success the request
 *     retries and resolves 200.
 *  3. Sensitive fields render for AUTO_HIDE_MS, then auto-collapse so
 *     a row left open on screen doesn't keep leaking.
 *  4. Admin/owner sessions skip the modal but still have to tap
 *     reveal — same UX, no accidental disclosure from a stray hover.
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

  // Auto-collapse so an unattended browser doesn't keep broadcasting.
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
          {email && <p className="text-xs text-gray-400">{email}</p>}
          {phone && <p className="text-xs text-gray-400">{phone}</p>}
          {kidsNames && (
            <p className="text-xs text-blue-600 mt-0.5 font-bold">{kidsNames}</p>
          )}
        </>
      )}

      {err && <p className="text-xs text-red-500 mt-0.5">{err}</p>}
    </div>
  );
}

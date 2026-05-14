"use client";

import { useState } from "react";

export interface LinkedMember {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  kids_names: string | null;
}

interface Props {
  /**
   * Fired when a valid PIN resolves to a member. The form should auto-fill
   * its fields and remember the member_id so it can be sent on submit.
   */
  onLink: (m: LinkedMember) => void;
  /** Fired when the user unlinks (clears) the PIN. Form should reset state. */
  onClear: () => void;
  /** Optional: render in dark theme (used on the shop page's dark form). */
  dark?: boolean;
}

/**
 * Optional "Already a member?" PIN lookup widget. Sits at the top of the
 * public form. Walk-ins ignore it and fill the form manually; members tap it
 * and have their name / phone / email pre-filled. The PIN check goes through
 * `/api/scanner/lookup`, which is rate-limited (8 wrong / 10 min → 30 min
 * lockout) so brute-forcing here is no easier than on /my-membership.
 */
export default function MemberPinLookup({ onLink, onClear, dark = false }: Props) {
  const [open, setOpen]       = useState(false);
  const [pin, setPin]         = useState("");
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const [linked, setLinked]   = useState<LinkedMember | null>(null);

  async function apply() {
    if (!/^\d{4}$/.test(pin)) {
      setErr("Enter your 4-digit PIN.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res  = await fetch(`/api/scanner/lookup?pin=${pin}`);
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        const mins = Number(data?.retry_after_minutes) || 30;
        setErr(`Too many tries. Try again in ${mins} min.`);
        return;
      }
      if (!res.ok || !data?.id) {
        setErr("PIN not found. Check the number on your card.");
        return;
      }
      const m: LinkedMember = {
        id:         data.id,
        name:       data.name,
        phone:      data.phone        ?? null,
        email:      data.email        ?? null,
        kids_names: data.kids_names   ?? null,
      };
      setLinked(m);
      setOpen(false);
      onLink(m);
    } catch {
      setErr("Connection problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function unlink() {
    setLinked(null);
    setPin("");
    setErr(null);
    onClear();
  }

  // ── Linked state: shows who's linked + an unlink button ────────
  if (linked) {
    return (
      <div className={`rounded-2xl border-2 px-4 py-3 mb-4 flex items-center justify-between gap-3 ${
        dark ? "bg-green-900/30 border-green-500/40 text-green-200"
             : "bg-green-50 border-green-300 text-green-800"
      }`}>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">Linked member</p>
          <p className="text-sm font-bold truncate">{linked.name}</p>
        </div>
        <button
          type="button"
          onClick={unlink}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
            dark ? "bg-white/10 hover:bg-white/20" : "bg-white text-green-700 hover:bg-green-100"
          }`}
        >
          Unlink
        </button>
      </div>
    );
  }

  // ── Collapsed prompt ───────────────────────────────────────────
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full rounded-2xl border-2 border-dashed px-4 py-3 mb-4 text-sm font-semibold transition-colors ${
          dark ? "border-white/20 text-white/70 hover:bg-white/5"
               : "border-gray-300 text-gray-600 hover:bg-gray-50"
        }`}
      >
        Already a member? <span className={dark ? "text-[#38bdf8]" : "text-[#1a56db]"}>Use my PIN</span>
      </button>
    );
  }

  // ── Expanded PIN input ─────────────────────────────────────────
  return (
    <div className={`rounded-2xl border-2 px-4 py-3 mb-4 ${
      dark ? "border-white/20 bg-white/5" : "border-gray-300 bg-white"
    }`}>
      <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${dark ? "text-white/70" : "text-gray-600"}`}>
        Member PIN (4 digits)
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="1234"
          className={`flex-1 rounded-xl border px-3 py-2.5 text-base font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-[#1a56db] ${
            dark ? "bg-[#1a2d40] text-white border-white/10 placeholder-white/30"
                 : "bg-white border-gray-200"
          }`}
        />
        <button
          type="button"
          onClick={apply}
          disabled={busy || pin.length !== 4}
          className="bg-[#1a56db] hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          {busy ? "…" : "Apply"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setPin(""); setErr(null); }}
          className={`text-sm font-semibold px-3 py-2.5 rounded-xl ${
            dark ? "text-white/60 hover:text-white" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Cancel
        </button>
      </div>
      {err && (
        <p className={`text-xs mt-2 ${dark ? "text-red-300" : "text-red-600"}`}>{err}</p>
      )}
    </div>
  );
}

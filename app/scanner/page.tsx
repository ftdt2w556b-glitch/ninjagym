"use client";

import { useState, useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MEMBERSHIP_TYPES } from "@/lib/pricing";

interface MemberResult {
  id: number;
  name: string;
  membership_type: string;
  slip_status: string;
  sessions_remaining: number | null;
  kids_names: string | null;
  kids_count: number;
  email: string | null;
}

export default function ScannerPage() {
  const [manualId, setManualId]       = useState("");
  const [member, setMember]           = useState<MemberResult | null>(null);
  const [error, setError]             = useState("");
  const [checkedIn, setCheckedIn]     = useState(false);
  const [sessionsLeft, setSessionsLeft] = useState<number | null>(null);
  const [loading, setLoading]         = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const params = new URLSearchParams(window.location.search);
    const memberId = params.get("member");
    if (memberId) lookupMember(memberId);
  }, []);

  async function lookupMember(id: string) {
    setLoading(true);
    setError("");
    setMember(null);
    setCheckedIn(false);
    setSessionsLeft(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error: dbError } = await supabase
      .from("member_registrations")
      .select("id, name, email, membership_type, slip_status, sessions_remaining, kids_names, kids_count")
      .eq("id", id)
      .single();

    setLoading(false);

    if (dbError || !data) {
      setError(`Member #${id} not found.`);
      return;
    }
    setMember(data);
  }

  async function handleCheckIn() {
    if (!member) return;
    setLoading(true);

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ member_id: member.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSessionsLeft(data.sessions_remaining);
      setCheckedIn(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setLoading(false);
    }

    // Auto-clear after 5 seconds
    setTimeout(() => {
      setMember(null);
      setCheckedIn(false);
      setSessionsLeft(null);
      setManualId("");
      inputRef.current?.focus();
    }, 5000);
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualId.trim()) lookupMember(manualId.trim());
  }

  const membershipLabel = member
    ? MEMBERSHIP_TYPES.find((m) => m.id === member.membership_type)?.label ?? member.membership_type
    : "";

  const isSessionBased = member && member.sessions_remaining !== null;

  return (
    <div className="min-h-dvh bg-gray-900 flex flex-col items-center justify-start pt-10 px-4">
      <h1 className="text-white font-fredoka text-4xl mb-2 text-center">QR Scanner</h1>
      <p className="text-gray-400 text-sm mb-8 text-center">Scan a member QR code or enter ID manually</p>

      {/* Manual ID input */}
      <form onSubmit={handleManualSubmit} className="flex gap-2 mb-8 w-full max-w-sm">
        <input
          ref={inputRef}
          type="text"
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          placeholder="Member ID or scan QR"
          className="flex-1 bg-gray-800 text-white border border-gray-600 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-[#1a56db] placeholder-gray-500"
          autoComplete="off"
        />
        <button type="submit"
          className="bg-[#1a56db] text-white font-bold px-5 py-3 rounded-xl hover:bg-blue-600 transition-colors">
          Go
        </button>
      </form>

      {loading && (
        <div className="text-gray-400 text-lg animate-pulse">Looking up...</div>
      )}

      {error && (
        <div className="bg-red-900/50 text-red-300 rounded-2xl px-6 py-4 text-center max-w-sm w-full">
          {error}
        </div>
      )}

      {/* ── Success state ── */}
      {checkedIn && member && (
        <div className="bg-green-500 text-white rounded-2xl p-6 text-center max-w-sm w-full">
          <div className="text-5xl mb-3">✓</div>
          <h2 className="font-fredoka text-3xl mb-1">{member.name}</h2>
          <p className="text-green-100 mb-3">Checked in successfully!</p>

          {/* Sessions remaining after check-in */}
          {isSessionBased && (
            <div className="bg-white/20 rounded-xl px-4 py-3 mb-3">
              {sessionsLeft !== null && sessionsLeft > 0 ? (
                <p className="text-white font-bold">
                  {sessionsLeft} session{sessionsLeft !== 1 ? "s" : ""} remaining
                </p>
              ) : sessionsLeft === 0 ? (
                <p className="text-yellow-200 font-bold">⚠️ Last session used — remind to renew!</p>
              ) : null}
            </div>
          )}

          {/* Loyalty / scan reminder */}
          {member.email && (
            <div className="bg-white/10 rounded-xl px-3 py-2 text-xs text-green-100">
              🌟 Points earned! Remind {member.name.split(" ")[0]} to always scan their QR card to keep earning loyalty points.
            </div>
          )}
          {!member.email && (
            <div className="bg-white/10 rounded-xl px-3 py-2 text-xs text-yellow-200">
              💡 No email on file — ask them to register online to start earning loyalty points & get their QR card.
            </div>
          )}
        </div>
      )}

      {/* ── Member found, not yet checked in ── */}
      {member && !checkedIn && (
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
          {/* Payment warning */}
          {member.slip_status !== "approved" && (
            <div className="bg-yellow-100 text-yellow-800 rounded-xl px-3 py-2 mb-4 text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>Payment <strong>{member.slip_status.replace("_", " ")}</strong> — confirm with member before checking in</span>
            </div>
          )}

          <h2 className="font-fredoka text-2xl text-gray-900 mb-1">{member.name}</h2>
          <p className="text-gray-500 text-sm mb-1">{membershipLabel}</p>
          {member.kids_names && (
            <p className="text-xs text-gray-400 mb-1">👶 Kids: {member.kids_names}</p>
          )}
          {member.email && (
            <p className="text-xs text-gray-400 mb-1">✉ {member.email}</p>
          )}

          {/* Sessions remaining */}
          {isSessionBased && member.sessions_remaining !== null && (
            <div className={`rounded-xl px-3 py-2 my-3 text-center ${
              member.sessions_remaining <= 1
                ? "bg-orange-50 border border-orange-200"
                : "bg-blue-50"
            }`}>
              <p className="text-xs text-gray-500">Sessions Remaining</p>
              <p className={`font-fredoka text-3xl ${
                member.sessions_remaining <= 1 ? "text-orange-500" : "text-[#1a56db]"
              }`}>
                {member.sessions_remaining}
              </p>
              {member.sessions_remaining <= 1 && (
                <p className="text-xs text-orange-500 font-medium">Almost out — suggest renewal!</p>
              )}
            </div>
          )}

          <button
            onClick={handleCheckIn}
            disabled={loading}
            className="w-full bg-[#22c55e] text-white font-bold text-xl py-4 rounded-2xl hover:bg-green-500 transition-colors disabled:opacity-50 mt-3"
          >
            {loading ? "Checking in…" : "✓ Check In"}
          </button>
          <button
            onClick={() => { setMember(null); setManualId(""); inputRef.current?.focus(); }}
            className="w-full text-gray-400 text-sm mt-3 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Hint for QR scanner */}
      {!member && !loading && !error && (
        <div className="text-gray-600 text-center text-sm mt-8 max-w-xs space-y-2">
          <p>Connect a USB or Bluetooth QR scanner — it types the member ID directly into the input above.</p>
          <p className="text-gray-700 text-xs">Each scan earns loyalty points for the member.</p>
        </div>
      )}
    </div>
  );
}

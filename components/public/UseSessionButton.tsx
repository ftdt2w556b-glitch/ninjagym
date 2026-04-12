"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Phase = "idle" | "picking" | "confirming" | "submitting" | "pending" | "approved" | "rejected" | "already_in";

interface Props {
  memberId: number;
  authMemberId: number;   // parent registration ID — what the cardToken is signed for
  memberName: string;
  membershipLabel: string;
  sessionsRemaining: number;
  maxKids: number;      // member's registered kids_count
  defaultKidsNames?: string; // pre-fill from member card
  cardToken: string;
}

export default function UseSessionButton({
  memberId,
  authMemberId,
  memberName,
  membershipLabel,
  sessionsRemaining,
  maxKids,
  defaultKidsNames = "",
  cardToken,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [kids, setKids] = useState(maxKids > 0 ? maxKids : 1);
  const [kidsNames, setKidsNames] = useState(defaultKidsNames);
  const [namesError, setNamesError] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  // On mount: check for existing pending OR already checked in today
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Check pending first
    supabase
      .from("pending_checkins")
      .select("id, status")
      .eq("member_id", memberId)
      .eq("status", "pending")
      .maybeSingle()
      .then(({ data: pendingData }) => {
        if (pendingData) {
          setPendingId(pendingData.id);
          setPhase("pending");
          return;
        }
        // Then check if already checked in today
        fetch(`/api/checkin/status?member_id=${memberId}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.today) setPhase("already_in");
          });
      });
  }, [memberId]);

  // Subscribe to realtime once we have a pendingId
  useEffect(() => {
    if (!pendingId) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`pending-${pendingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pending_checkins", filter: `id=eq.${pendingId}` },
        (payload) => {
          const s = (payload.new as { status: string }).status;
          if (s === "approved") setPhase("approved");
          else if (s === "rejected") setPhase("rejected");
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pendingId]);

  async function submit() {
    setPhase("submitting");
    setError("");
    try {
      const res = await fetch("/api/checkin/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          auth_id: authMemberId,  // token was signed for the parent registration
          kids_count: kids,
          kids_names: kidsNames.trim() || null,
          membership_type: membershipLabel, // use label as type for display
          membership_label: membershipLabel,
          token: cardToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to submit"); setPhase("confirming"); return; }
      setPendingId(data.id);
      setPhase("pending");
    } catch {
      setError("Something went wrong. Please try again.");
      setPhase("confirming");
    }
  }

  // ── idle ──────────────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <button
        onClick={() => { setKids(maxKids > 0 ? maxKids : 1); setPhase("picking"); }}
        className="w-full bg-gradient-to-b from-[#4cff5e] to-[#1db02b] text-white font-bold text-2xl rounded-2xl py-6 mt-2 shadow-xl hover:brightness-110 active:scale-95 transition-all tracking-wide"
      >
        USE A SESSION
      </button>
    );
  }

  // ── picking kids ──────────────────────────────────────────────────────────
  if (phase === "picking") {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-6 flex flex-col gap-5 mt-2">
        <p className="text-center font-bold text-gray-800 text-xl">How many kids today?</p>
        {/* +/- stepper */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => setKids((k) => Math.max(1, k - 1))}
            className="w-16 h-16 rounded-2xl text-3xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all border border-gray-200"
          >
            −
          </button>
          <span className="text-6xl font-bold text-[#1a56db] w-16 text-center">{kids}</span>
          <button
            onClick={() => setKids((k) => Math.min(10, k + 1))}
            className="w-16 h-16 rounded-2xl text-3xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all border border-gray-200"
          >
            +
          </button>
        </div>
        {/* Kids names — required so staff can find the right child */}
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">
            Kids names <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={kidsNames}
            onChange={(e) => { setKidsNames(e.target.value); setNamesError(false); }}
            placeholder="e.g. Nami, Luffy"
            className={`w-full border rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#1a56db] ${namesError ? "border-red-400 bg-red-50" : "border-gray-200"}`}
          />
          {namesError && <p className="text-red-500 text-sm mt-1">Please enter the kids names so staff can find them.</p>}
        </div>
        <div className="flex gap-3 mt-1">
          <button onClick={() => setPhase("idle")} className="flex-1 py-4 rounded-xl border border-gray-200 text-gray-500 font-semibold text-lg">Cancel</button>
          <button
            onClick={() => {
              if (!kidsNames.trim()) { setNamesError(true); return; }
              setPhase("confirming");
            }}
            className="flex-1 py-4 rounded-xl bg-[#1a56db] text-white font-bold text-lg"
          >
            Next →
          </button>
        </div>
      </div>
    );
  }

  // ── confirming ────────────────────────────────────────────────────────────
  if (phase === "confirming") {
    const afterSessions = sessionsRemaining - kids;
    return (
      <div className="bg-white rounded-2xl shadow-xl p-5 flex flex-col gap-3 mt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-gray-800 text-lg">Confirm check-in</p>
            <p className="text-gray-400 text-sm">{memberName}</p>
          </div>
          <p className="text-4xl">🤔</p>
        </div>
        <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[#1a56db] font-bold text-3xl">{kids} kid{kids !== 1 ? "s" : ""}</p>
            <p className="text-gray-500 text-sm">{membershipLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">After this</p>
            <p className={`text-lg font-bold ${afterSessions <= 0 ? "text-red-500" : afterSessions <= 2 ? "text-orange-500" : "text-gray-700"}`}>
              {Math.max(0, afterSessions)} left
            </p>
          </div>
        </div>
        {kidsNames && <p className="text-xs text-gray-500 text-center">👦 {kidsNames}</p>}
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <div className="flex gap-3">
          <button onClick={() => setPhase("picking")} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 font-semibold">← Back</button>
          <button
            onClick={submit}
            className="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold text-lg hover:bg-green-600 transition-colors"
          >
            YES — Check In
          </button>
        </div>
      </div>
    );
  }

  // ── submitting ────────────────────────────────────────────────────────────
  if (phase === "submitting") {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-[#1a56db] border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-gray-600">Submitting...</p>
      </div>
    );
  }

  // ── pending (waiting for staff) ───────────────────────────────────────────
  if (phase === "pending") {
    return (
      <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-xl p-5 text-center">
        <p className="text-3xl mb-2">⏳</p>
        <p className="font-bold text-amber-800 text-lg">Waiting for staff to confirm</p>
        <p className="text-amber-600 text-sm mt-1">{kids} kid{kids !== 1 ? "s" : ""} · {membershipLabel}</p>
        <p className="text-gray-400 text-xs mt-3">Please show this screen to a staff member</p>
      </div>
    );
  }

  // ── approved ──────────────────────────────────────────────────────────────
  if (phase === "approved") {
    return (
      <div className="bg-green-50 border-2 border-green-400 rounded-2xl shadow-xl p-5 text-center">
        <p className="text-4xl mb-2">✅</p>
        <p className="font-bold text-green-700 text-xl">Checked in!</p>
        <p className="text-green-600 text-sm mt-1">Have fun, {memberName.split(" ")[0]}!</p>
      </div>
    );
  }

  // ── already checked in today ───────────────────────────────────────────────
  if (phase === "already_in") {
    return (
      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mt-2 flex flex-col gap-3">
        <div className="text-center">
          <p className="font-bold text-blue-700">✓ Already checked in today</p>
          <p className="text-blue-500 text-sm mt-1">Your kid(s) already have a session logged for today.</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-xs font-semibold text-amber-700 leading-snug">
            ⚠️ Each program package allows one session per visit. A second check-in today will use another session from your package.
          </p>
        </div>
        <button
          onClick={() => { setKids(maxKids > 0 ? maxKids : 1); setPhase("picking"); }}
          className="w-full py-3 rounded-xl border-2 border-blue-300 text-blue-700 font-semibold text-sm hover:bg-blue-100 transition-colors"
        >
          Check in again anyway →
        </button>
      </div>
    );
  }

  // ── rejected ──────────────────────────────────────────────────────────────
  if (phase === "rejected") {
    return (
      <div className="bg-red-50 border-2 border-red-300 rounded-2xl shadow-xl p-5 text-center">
        <p className="text-4xl mb-2">❌</p>
        <p className="font-bold text-red-700 text-lg">Check-in was not approved</p>
        <p className="text-red-500 text-sm mt-1">Please speak with staff</p>
        <button
          onClick={() => { setPhase("idle"); setPendingId(null); }}
          className="mt-4 text-xs text-gray-400 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return null;
}

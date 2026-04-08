"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Phase = "idle" | "picking" | "confirming" | "submitting" | "pending" | "approved" | "rejected";

interface Props {
  memberId: number;
  memberName: string;
  membershipLabel: string;
  sessionsRemaining: number;
  maxKids: number;      // member's registered kids_count
  cardToken: string;
}

export default function UseSessionButton({
  memberId,
  memberName,
  membershipLabel,
  sessionsRemaining,
  maxKids,
  cardToken,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [kids, setKids] = useState(maxKids > 0 ? maxKids : 1);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  // On mount: check if there's already a pending request for this member
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("pending_checkins")
      .select("id, status")
      .eq("member_id", memberId)
      .eq("status", "pending")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPendingId(data.id);
          setPhase("pending");
        }
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
          kids_count: kids,
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
        <div className="flex gap-3 mt-1">
          <button onClick={() => setPhase("idle")} className="flex-1 py-4 rounded-xl border border-gray-200 text-gray-500 font-semibold text-lg">Cancel</button>
          <button
            onClick={() => setPhase("confirming")}
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
    return (
      <div className="bg-white rounded-2xl shadow-xl p-5 flex flex-col gap-4">
        <div className="text-center">
          <p className="text-4xl mb-2">🤔</p>
          <p className="font-bold text-gray-800 text-xl">Are you sure?</p>
          <p className="text-gray-500 text-sm mt-1">{memberName}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-[#1a56db] font-bold text-2xl">{kids} kid{kids !== 1 ? "s" : ""}</p>
          <p className="text-gray-600 text-sm">{membershipLabel}</p>
          <p className="text-gray-400 text-xs mt-1">{sessionsRemaining} session{sessionsRemaining !== 1 ? "s" : ""} remaining after this</p>
        </div>
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
        <button
          onClick={() => { setPhase("idle"); setPendingId(null); }}
          className="mt-4 text-xs text-gray-400 underline"
        >
          Done
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

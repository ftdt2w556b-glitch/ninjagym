"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface BeltPerk {
  beltLabel: string;
  beltEmoji: string;
  perkLabel: string;
  perkType: string;
}

type Phase = "idle" | "submitting" | "pending" | "approved" | "rejected";

interface Props {
  memberId: number;
  memberName: string;
  kidsNames: string | null;
  cardToken: string;
  unlockedPerks: BeltPerk[];
}

export default function BeltPerksSection({
  memberId,
  memberName,
  kidsNames,
  cardToken,
  unlockedPerks,
}: Props) {
  const [open, setOpen]           = useState(false);
  const [phases, setPhases]       = useState<Record<string, Phase>>({});
  const [pendingIds, setPendingIds] = useState<Record<string, number | null>>({});

  // Realtime subscription — one channel per pending perk
  useEffect(() => {
    const supabase  = createSupabaseBrowserClient();
    const channels: ReturnType<typeof supabase.channel>[] = [];

    for (const [perkType, pendingId] of Object.entries(pendingIds)) {
      if (!pendingId) continue;
      const channel = supabase
        .channel(`belt-perk-${pendingId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "pending_checkins", filter: `id=eq.${pendingId}` },
          (payload) => {
            const s = (payload.new as { status: string }).status;
            if (s === "approved") {
              setPhases((p) => ({ ...p, [perkType]: "approved" }));
              setTimeout(() => {
                setPhases((p)    => ({ ...p, [perkType]: "idle" }));
                setPendingIds((p) => ({ ...p, [perkType]: null }));
              }, 4000);
            } else if (s === "rejected") {
              setPhases((p) => ({ ...p, [perkType]: "rejected" }));
              setTimeout(() => {
                setPhases((p)    => ({ ...p, [perkType]: "idle" }));
                setPendingIds((p) => ({ ...p, [perkType]: null }));
              }, 4000);
            }
          }
        )
        .subscribe();
      channels.push(channel);
    }

    return () => { channels.forEach((c) => { supabase.removeChannel(c); }); };
  }, [pendingIds]);

  async function handleRedeem(perkType: string, perkLabel: string) {
    const phase = phases[perkType] ?? "idle";
    if (phase === "submitting" || phase === "pending") return;
    setPhases((p) => ({ ...p, [perkType]: "submitting" }));
    try {
      const res = await fetch(`/api/members/${memberId}/redeem-perk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cardToken, perkType, perkLabel, memberName, kidsNames }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        setPendingIds((p) => ({ ...p, [perkType]: data.id }));
        setPhases((p)    => ({ ...p, [perkType]: "pending" }));
      } else {
        setPhases((p) => ({ ...p, [perkType]: "idle" }));
        alert(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setPhases((p) => ({ ...p, [perkType]: "idle" }));
      alert("Connection error. Please try again.");
    }
  }

  if (unlockedPerks.length === 0) return null;

  return (
    <div className="mt-4 bg-white rounded-2xl shadow overflow-hidden">
      {/* Collapsed header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🥋</span>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">My Perks</p>
          <span className="bg-[#1a56db] text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {unlockedPerks.length}
          </span>
        </div>
        <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {/* Expanded perk list */}
      {open && (
        <div className="border-t border-gray-100">
          <div className="divide-y divide-gray-50">
            {unlockedPerks.map(({ beltLabel, beltEmoji, perkLabel, perkType }) => {
              const phase = phases[perkType] ?? "idle";
              return (
                <div key={perkType} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{perkLabel}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{beltEmoji} {beltLabel}</p>
                  </div>

                  {phase === "idle" && (
                    <button
                      onClick={() => handleRedeem(perkType, perkLabel)}
                      className="shrink-0 bg-[#1a56db] text-white font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Redeem
                    </button>
                  )}
                  {phase === "submitting" && (
                    <span className="shrink-0 text-xs text-gray-400">...</span>
                  )}
                  {phase === "pending" && (
                    <span className="shrink-0 text-xs text-amber-600 font-semibold text-right">Waiting for staff</span>
                  )}
                  {phase === "approved" && (
                    <span className="shrink-0 text-xs text-green-600 font-bold">Approved!</span>
                  )}
                  {phase === "rejected" && (
                    <span className="shrink-0 text-xs text-red-500 font-semibold">Declined</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="px-5 py-3 bg-gray-50">
            <p className="text-xs text-gray-400">Show your card to staff. They will confirm and honor your perk.</p>
          </div>
        </div>
      )}
    </div>
  );
}

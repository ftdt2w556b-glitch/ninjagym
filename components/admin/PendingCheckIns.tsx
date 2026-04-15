"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface PendingCheckin {
  id: number;
  member_id: number;
  member_name: string;
  kids_count: number;
  kids_names: string | null;
  membership_type: string | null;
  membership_label: string;
  requested_at: string;
  status: string;
  payment_method: string | null;
  amount_paid: number | null;
  slip_image: string | null;
  // enriched from member_registrations
  pin?: string | null;
}

interface Props {
  staffName: string;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export default function PendingCheckIns({ staffName }: Props) {
  const [items, setItems] = useState<PendingCheckin[]>([]);
  const [handling, setHandling] = useState<Record<number, boolean>>({});

  const fetchPending = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("pending_checkins")
      .select("id, member_id, member_name, kids_count, kids_names, membership_type, membership_label, requested_at, status, payment_method, amount_paid, slip_image")
      .eq("status", "pending")
      .order("requested_at", { ascending: true });

    const rows = (data ?? []) as PendingCheckin[];

    // Enrich with PIN from member_registrations (follow parent_member_id for top-ups)
    if (rows.length > 0) {
      const memberIds = rows.map((r) => r.member_id);
      const { data: members } = await supabase
        .from("member_registrations")
        .select("id, pin, parent_member_id")
        .in("id", memberIds);

      type MemberInfo = { pin?: string | null; parent_member_id?: number | null };
      const memberMap: Record<number, MemberInfo> = {};
      for (const m of members ?? []) memberMap[m.id] = { pin: m.pin, parent_member_id: m.parent_member_id };

      const parentIds = [...new Set(
        Object.values(memberMap)
          .filter((m) => !m.pin && m.parent_member_id)
          .map((m) => m.parent_member_id as number)
      )];
      if (parentIds.length > 0) {
        const { data: parents } = await supabase
          .from("member_registrations")
          .select("id, pin")
          .in("id", parentIds);
        for (const p of parents ?? []) memberMap[p.id] = { pin: p.pin };
      }

      for (const r of rows) {
        const direct = memberMap[r.member_id];
        const parent = direct?.parent_member_id ? memberMap[direct.parent_member_id] : null;
        r.pin = direct?.pin ?? parent?.pin ?? null;
      }
    }

    setItems(rows);
  }, []);

  useEffect(() => {
    fetchPending();

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("pending-checkins-pos")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pending_checkins" }, () => {
        fetchPending();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pending_checkins" }, (payload) => {
        const updated = payload.new as PendingCheckin;
        if (updated.status !== "pending") {
          // Approved or rejected — remove from list
          setItems((prev) => prev.filter((p) => p.id !== updated.id));
        } else {
          // Still pending but something changed (e.g. parent updated kids_count) — refresh in place
          setItems((prev) => prev.map((p) => p.id === updated.id ? updated : p));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPending]);

  async function handle(id: number, action: "approve" | "reject") {
    setHandling((h) => ({ ...h, [id]: true }));
    try {
      await fetch("/api/checkin/handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, staff_name: staffName }),
      });
      setItems((prev) => prev.filter((p) => p.id !== id));
      await fetchPending(); // re-fetch to clear any ghost records
    } finally {
      setHandling((h) => { const n = { ...h }; delete n[id]; return n; });
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="mb-4">
      {items.map((item) => {
        const minutesAgo = Math.floor((Date.now() - new Date(item.requested_at).getTime()) / 60000);
        const timeLabel = minutesAgo < 1 ? "just now" : `${minutesAgo}m ago`;
        const isPayment = !!item.payment_method;
        const isCash = item.payment_method === "cash";
        const isPromptPay = item.payment_method === "promptpay";
        const isBulk = item.membership_type?.endsWith("_bulk") ?? false;
        const slipUrl = item.slip_image
          ? `${SUPABASE_URL}/storage/v1/object/public/slips/${item.slip_image}`
          : null;

        return (
          <div
            key={item.id}
            className="animate-pulse-once bg-amber-400 text-gray-900 rounded-2xl px-5 py-4 mb-2 shadow-lg"
          >
            {/* Top row: name + time */}
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-lg leading-tight">{item.member_name}</p>
              <p className="text-xs text-amber-800">{timeLabel}</p>
            </div>

            {/* Main info block */}
            <div className="bg-white/80 rounded-2xl py-3 px-4 mb-3 flex items-center justify-between">
              {isBulk ? (
                /* Bulk purchase — payment approval only, no check-in */
                <div className="w-full">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Session pack purchase</p>
                  <p className="text-2xl font-black text-gray-900 leading-none">{item.membership_label}</p>
                  <p className="text-sm text-gray-500 mt-1">Verify payment slip — sessions will be available after approval</p>
                </div>
              ) : (
                /* Regular check-in — kids count is the key detail */
                <>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Kids checking in today</p>
                    <p className="text-5xl font-black text-gray-900 leading-none">
                      {item.kids_count}
                      <span className="text-lg font-semibold text-gray-500 ml-2">
                        kid{item.kids_count !== 1 ? "s" : ""}
                      </span>
                    </p>
                    {item.kids_names && (
                      <p className="text-sm font-semibold text-gray-700 mt-1">👦 {item.kids_names}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400 mb-1">Membership</p>
                    <p className="text-sm font-semibold text-gray-700">{item.membership_label || "Session"}</p>
                    {item.pin && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-400">PIN</p>
                        <p className="text-lg font-black text-gray-800 tracking-widest">{item.pin}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Payment info */}
            {isPayment && (
              <div className="mb-3 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold ${
                  isCash
                    ? "bg-green-100 text-green-800 border border-green-300"
                    : "bg-blue-100 text-blue-800 border border-blue-300"
                }`}>
                  {isCash ? "💵" : "📱"} ฿{(item.amount_paid ?? 0).toLocaleString()} {isCash ? "cash" : "PromptPay"}
                </span>
                {isPromptPay && slipUrl && (
                  <a
                    href={slipUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold bg-white/70 hover:bg-white border border-amber-300 transition-colors"
                  >
                    🧾 View Slip
                  </a>
                )}
                {isPromptPay && !slipUrl && (
                  <span className="text-xs text-amber-800 italic">no slip uploaded</span>
                )}
              </div>
            )}

            {/* Staff double-check reminder */}
            <div className="bg-amber-900/20 rounded-xl px-3 py-2 mb-3">
              <p className="text-xs font-semibold text-amber-900 leading-snug">
                {isBulk
                  ? "⚠️ Verify payment slip: date, amount, and program match. No check-in — sessions unlock after approval."
                  : "⚠️ Double-check before approving: number of kids, payment slip date, program, and amount paid match."}
              </p>
            </div>

            {/* Approve / Reject */}
            <div className="flex gap-2">
              <button
                disabled={handling[item.id]}
                onClick={() => handle(item.id, "approve")}
                className="flex-1 bg-green-500 hover:bg-green-400 text-white font-bold py-3 rounded-xl text-base disabled:opacity-50 transition-colors"
              >
                {handling[item.id] ? "…" : isBulk ? "✓ Approve Payment" : isPayment ? "✓ Paid & In" : "✓ Approve"}
              </button>
              <button
                disabled={handling[item.id]}
                onClick={() => handle(item.id, "reject")}
                className="bg-red-500 hover:bg-red-400 text-white font-bold px-5 py-3 rounded-xl text-base disabled:opacity-50 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

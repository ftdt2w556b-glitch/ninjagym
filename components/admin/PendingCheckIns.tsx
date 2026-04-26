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
  sessions_remaining?: number | null;
  card_member_id?: number; // parent ID if top-up, else member_id
}

interface Props {
  staffName: string;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export default function PendingCheckIns({ staffName }: Props) {
  const [items, setItems] = useState<PendingCheckin[]>([]);
  const [handling, setHandling] = useState<Record<number, boolean>>({});
  const [rejectState, setRejectState] = useState<Record<number, { active: boolean; reason: string }>>({});

  const fetchPending = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("pending_checkins")
      .select("id, member_id, member_name, kids_count, kids_names, membership_type, membership_label, requested_at, status, payment_method, amount_paid, slip_image")
      .eq("status", "pending")
      .order("requested_at", { ascending: true });

    const rows = (data ?? []) as PendingCheckin[];

    // Enrich with PIN, sessions_remaining, and card link from member_registrations
    if (rows.length > 0) {
      const memberIds = rows.map((r) => r.member_id);
      const { data: members } = await supabase
        .from("member_registrations")
        .select("id, pin, parent_member_id, sessions_remaining")
        .in("id", memberIds);

      type MemberInfo = { pin?: string | null; parent_member_id?: number | null; sessions_remaining?: number | null };
      const memberMap: Record<number, MemberInfo> = {};
      for (const m of members ?? []) {
        memberMap[m.id] = { pin: m.pin, parent_member_id: m.parent_member_id, sessions_remaining: m.sessions_remaining };
      }

      // Fetch parent rows to get PIN if not on the direct row
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
        for (const p of parents ?? []) memberMap[p.id] = { ...memberMap[p.id], pin: p.pin };
      }

      for (const r of rows) {
        const direct = memberMap[r.member_id];
        const parentId = direct?.parent_member_id ?? null;
        const parent = parentId ? memberMap[parentId] : null;
        r.pin = direct?.pin ?? parent?.pin ?? null;
        r.sessions_remaining = direct?.sessions_remaining ?? null;
        r.card_member_id = parentId ?? r.member_id;
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

  async function handle(id: number, action: "approve" | "reject", reason?: string) {
    setHandling((h) => ({ ...h, [id]: true }));
    try {
      await fetch("/api/checkin/handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, staff_name: staffName, reason }),
      });
      setItems((prev) => prev.filter((p) => p.id !== id));
      setRejectState((s) => { const n = { ...s }; delete n[id]; return n; });
      await fetchPending();
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
            {/* Top row: name + PIN + time */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="font-bold text-lg leading-tight">{item.member_name}</p>
                <span className="bg-amber-900/20 text-amber-900 text-xs font-black px-2 py-0.5 rounded-lg tracking-widest">
                  #{item.pin ?? item.member_id}
                </span>
              </div>
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
                    <a
                      href={`/qr/card/${item.card_member_id ?? item.member_id}?from=admin`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline font-semibold mb-1 inline-block"
                    >
                      Membership ↗
                    </a>
                    <p className="text-sm font-semibold text-gray-700">{item.membership_label || "Session"}</p>
                    {item.sessions_remaining !== null && item.sessions_remaining !== undefined && item.membership_type !== "free_session_loyalty" && (
                      <p className={`text-xs mt-0.5 font-semibold ${Math.max(0, item.sessions_remaining - item.kids_count) === 0 ? "text-red-500" : "text-gray-500"}`}>
                        {Math.max(0, item.sessions_remaining - item.kids_count)} left after this
                      </p>
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
                  : "⚠️ Check number of kids (+names), pay date, and match program and amount paid."}
              </p>
            </div>

            {/* Approve / Reject */}
            {rejectState[item.id]?.active ? (
              <div className="space-y-2">
                <p className="text-sm font-bold text-gray-900">Why are you rejecting this?</p>
                <textarea
                  value={rejectState[item.id].reason}
                  onChange={(e) => setRejectState((s) => ({ ...s, [item.id]: { active: true, reason: e.target.value } }))}
                  placeholder="e.g. Wrong number of kids, invalid slip, wrong amount…"
                  rows={2}
                  autoFocus
                  className="w-full border border-red-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                <div className="flex gap-2">
                  <button
                    disabled={handling[item.id] || !rejectState[item.id].reason.trim()}
                    onClick={() => handle(item.id, "reject", rejectState[item.id].reason)}
                    className="flex-1 bg-red-500 hover:bg-red-400 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 transition-colors"
                  >
                    {handling[item.id] ? "…" : "Confirm Reject"}
                  </button>
                  <button
                    disabled={handling[item.id]}
                    onClick={() => setRejectState((s) => { const n = { ...s }; delete n[item.id]; return n; })}
                    className="px-5 py-3 rounded-xl border border-gray-300 bg-white/70 text-gray-700 font-semibold text-sm hover:bg-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
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
                  onClick={() => setRejectState((s) => ({ ...s, [item.id]: { active: true, reason: "" } }))}
                  className="bg-red-500 hover:bg-red-400 text-white font-bold px-5 py-3 rounded-xl text-base disabled:opacity-50 transition-colors"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

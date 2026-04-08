"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface PendingCheckin {
  id: number;
  member_id: number;
  member_name: string;
  kids_count: number;
  membership_label: string;
  requested_at: string;
  status: string;
  payment_method: string | null;
  amount_paid: number | null;
  slip_image: string | null;
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
      .select("id, member_id, member_name, kids_count, membership_label, requested_at, status, payment_method, amount_paid, slip_image")
      .eq("status", "pending")
      .order("requested_at", { ascending: true });
    setItems((data ?? []) as PendingCheckin[]);
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
          setItems((prev) => prev.filter((p) => p.id !== updated.id));
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
        const slipUrl = item.slip_image
          ? `${SUPABASE_URL}/storage/v1/object/public/slips/${item.slip_image}`
          : null;

        return (
          <div
            key={item.id}
            className="animate-pulse-once bg-amber-400 text-gray-900 rounded-2xl px-5 py-4 mb-2 shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg leading-tight">{item.member_name}</p>
                <p className="text-sm font-semibold">
                  {item.kids_count} kid{item.kids_count !== 1 ? "s" : ""} · {item.membership_label || "Session"}
                </p>

                {/* Payment info */}
                {isPayment && (
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
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

                <p className="text-xs text-amber-800 mt-1">{timeLabel}</p>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <button
                  disabled={handling[item.id]}
                  onClick={() => handle(item.id, "approve")}
                  className="bg-green-500 hover:bg-green-400 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-50 transition-colors"
                >
                  {handling[item.id] ? "…" : isPayment ? "✓ Paid & In" : "✓ Approve"}
                </button>
                <button
                  disabled={handling[item.id]}
                  onClick={() => handle(item.id, "reject")}
                  className="bg-red-500 hover:bg-red-400 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-50 transition-colors"
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

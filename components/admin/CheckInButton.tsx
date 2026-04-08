"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "idle" | "checking" | "pending_warn" | "today_warn" | "confirm";

interface PendingInfo { id: number; kids_count: number; membership_label: string }
interface TodayInfo   { time: string; kids_count: number }

export default function CheckInButton({
  regId,
  label,
  sessionsRemaining,
  staffName,
  kidsCount = 1,
}: {
  regId: number;
  label: string;
  sessionsRemaining?: number | null;
  staffName?: string;
  kidsCount?: number;
}) {
  const router = useRouter();
  const [step, setStep]           = useState<Step>("idle");
  const [kidsToday, setKidsToday] = useState(kidsCount);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<"ok" | "warn" | null>(null);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const [pending, setPending]     = useState<PendingInfo | null>(null);
  const [today, setToday]         = useState<TodayInfo | null>(null);

  async function handleClick() {
    setKidsToday(kidsCount);
    setErrorMsg(null);
    setStep("checking");

    try {
      const res = await fetch(`/api/checkin/status?member_id=${regId}`);
      const data = await res.json();

      if (data.pending) {
        setPending(data.pending);
        setStep("pending_warn");
      } else if (data.today) {
        setToday(data.today);
        setStep("today_warn");
      } else {
        setStep("confirm");
      }
    } catch {
      setStep("confirm"); // fall through on error
    }
  }

  async function approvePending() {
    if (!pending) return;
    setLoading(true);
    try {
      await fetch("/api/checkin/handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pending.id, action: "approve", staff_name: staffName ?? "Staff" }),
      });
      setResult("ok");
      setStep("idle");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    setErrorMsg(null);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_id: regId,
        note: `Check-in by ${staffName ?? "Staff"}`,
        kids_count_override: kidsToday,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setResult(data.outOfSessions ? "warn" : "ok");
      setStep("idle");
      router.refresh();
    } else {
      setErrorMsg(data.error ?? "Check-in failed");
      setStep("idle");
    }
  }

  function cancel() { setStep("idle"); setPending(null); setToday(null); }

  // ── Results ────────────────────────────────────────────────────────────────
  if (result === "ok")   return <span className="text-xs text-green-600 font-semibold">✓ Checked in</span>;
  if (result === "warn") return <span className="text-xs text-orange-500 font-semibold">✓ Checked in (0 left)</span>;

  // ── Checking spinner ───────────────────────────────────────────────────────
  if (step === "checking") {
    return <span className="text-xs text-gray-400">checking…</span>;
  }

  // ── Pending warning ────────────────────────────────────────────────────────
  if (step === "pending_warn" && pending) {
    return (
      <div className="flex flex-col gap-1.5 mt-0.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-xs">
        <p className="text-xs font-bold text-amber-700">
          ⚠️ Parent submitted {pending.kids_count} kid{pending.kids_count !== 1 ? "s" : ""} — pending approval
        </p>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={approvePending}
            disabled={loading}
            className="text-xs bg-green-500 text-white font-semibold px-2.5 py-1 rounded-lg hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? "…" : "✓ Approve It"}
          </button>
          <button
            onClick={() => { setPending(null); setStep("confirm"); }}
            className="text-xs bg-[#1a56db] text-white font-semibold px-2.5 py-1 rounded-lg hover:bg-blue-700"
          >
            New Session
          </button>
          <button onClick={cancel} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      </div>
    );
  }

  // ── Already checked in today ───────────────────────────────────────────────
  if (step === "today_warn" && today) {
    return (
      <div className="flex flex-col gap-1.5 mt-0.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 max-w-xs">
        <p className="text-xs font-bold text-blue-700">
          ℹ️ Checked in today at {today.time} ({today.kids_count} kid{today.kids_count !== 1 ? "s" : ""})
        </p>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => { setToday(null); setStep("confirm"); }}
            className="text-xs bg-[#1a56db] text-white font-semibold px-2.5 py-1 rounded-lg hover:bg-blue-700"
          >
            Another Session
          </button>
          <button onClick={cancel} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      </div>
    );
  }

  // ── Confirm ────────────────────────────────────────────────────────────────
  if (step === "confirm") {
    return (
      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
        {kidsCount > 1 && (
          <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
            <button
              type="button"
              onClick={() => setKidsToday(Math.max(1, kidsToday - 1))}
              className="text-blue-500 hover:text-blue-800 font-bold leading-none w-4 text-center"
            >−</button>
            <span className="text-xs font-bold text-blue-700 w-12 text-center">
              {kidsToday} kid{kidsToday !== 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={() => setKidsToday(Math.min(10, kidsToday + 1))}
              className="text-blue-500 hover:text-blue-800 font-bold leading-none w-4 text-center"
            >+</button>
          </div>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className="text-xs bg-[#1a56db] text-white font-semibold px-2.5 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "…" : "Confirm"}
        </button>
        <button type="button" onClick={cancel} className="text-xs text-gray-400 hover:text-gray-600">
          Cancel
        </button>
        {errorMsg && <span className="text-xs text-red-500 leading-tight">{errorMsg}</span>}
      </div>
    );
  }

  // ── Idle ───────────────────────────────────────────────────────────────────
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`text-xs underline disabled:opacity-40 whitespace-nowrap ${
        sessionsRemaining === 0
          ? "text-orange-400 hover:text-orange-600"
          : "text-gray-400 hover:text-[#1a56db]"
      }`}
    >
      {sessionsRemaining === 0 ? "Check In (0 left)" : "Check In"}
    </button>
  );
}

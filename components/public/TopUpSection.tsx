"use client";

import { useState } from "react";
import Image from "next/image";
import { MEMBERSHIP_TYPES, getPriceForType, formatTHB } from "@/lib/pricing";

// Bulk types need a qty slider — not suitable for quick top-up. Direct to /join for those.
const TOPUP_TYPES = MEMBERSHIP_TYPES.filter((m) => !m.bulk);

interface CheckIn {
  id: number;
  check_in_at: string;
  notes: string | null;
}

interface Props {
  memberId: number;
  memberName: string;
  memberPhone: string | null;
  currentType: string;
  defaultKids: number;
  recentCheckIns: CheckIn[];
}

export default function TopUpSection({
  memberId,
  memberName,
  memberPhone,
  currentType,
  defaultKids,
  recentCheckIns,
}: Props) {
  // Shared state — program picker in CONTINUE TRAINING also drives ADD SESSIONS price
  const safeInitial = TOPUP_TYPES.find((m) => m.id === currentType)
    ? currentType
    : TOPUP_TYPES[0].id;
  const [selectedType, setSelectedType] = useState(safeInitial);
  const [kidsCount, setKidsCount]       = useState(defaultKids);

  const [loading, setLoading]         = useState<string | null>(null);
  const [success, setSuccess]         = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [showPromptPay, setShowPromptPay] = useState(false);

  const selectedMt = TOPUP_TYPES.find((m) => m.id === selectedType);
  const price      = getPriceForType(selectedType, kidsCount);

  async function doRegister(paymentMethod: "cash" | "promptpay") {
    setLoading(paymentMethod);
    setError(null);

    const body = new FormData();
    body.append("name", memberName);
    if (memberPhone) body.append("phone", memberPhone);
    body.append("membership_type", selectedType);
    body.append("kids_count", String(kidsCount));
    body.append("payment_method", paymentMethod);
    body.append("amount_paid", String(price));
    body.append("notes", `Top-up from member card #${memberId}`);

    try {
      const res  = await fetch("/api/members", { method: "POST", body });
      const data = await res.json();
      setLoading(null);
      if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
      if (paymentMethod === "cash") {
        setSuccess(`Registered for ${selectedMt?.label}! ✅ Pay cash when you arrive — staff will check you in.`);
      } else {
        setShowPromptPay(true);
      }
    } catch {
      setLoading(null);
      setError("Something went wrong — please try again.");
    }
  }

  // ── PromptPay payment screen ───────────────────────────────────────────────
  if (showPromptPay) {
    return (
      <div className="mt-4 flex flex-col gap-3">
        <div className="bg-white rounded-2xl p-5 shadow flex flex-col gap-4">
          <button
            onClick={() => setShowPromptPay(false)}
            className="text-gray-400 text-sm text-left underline"
          >
            ← Back
          </button>
          <div className="text-center">
            <p className="text-xs font-bold text-[#1a56db] uppercase tracking-wide mb-3">
              Scan to Pay
            </p>
            <Image
              src="/images/promptpay-qr-small.png"
              alt="PromptPay QR"
              width={160}
              height={160}
              className="mx-auto rounded-xl mb-3"
            />
            <p className="text-xs text-gray-500 mb-0.5">PromptPay Number</p>
            <p className="font-fredoka text-2xl text-[#1a56db] tracking-widest">086-294-4374</p>
            <p className="text-sm text-gray-600 font-semibold">Rick Tew Co., Ltd.</p>
          </div>
          <div className="bg-[#ffe033] rounded-xl px-4 py-3 text-center">
            <p className="text-xs font-bold text-[#1a56db] uppercase tracking-wide mb-0.5">
              Amount to Transfer
            </p>
            <p className="font-fredoka text-2xl text-[#1a56db]">{formatTHB(price)}</p>
          </div>
          <p className="text-sm text-gray-600 text-center">
            Screenshot the confirmation and show staff to complete your check-in.
          </p>
        </div>
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────
  return (
    <div className="mt-4 flex flex-col gap-3">

      {/* ── CONTINUE TRAINING — program picker (drives ADD SESSIONS price too) */}
      <div className="bg-white rounded-2xl p-5 shadow">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
          Continue Training
        </p>
        <p className="text-sm text-gray-500 mb-3">
          Pick a program — just pick and go.
        </p>

        <select
          value={selectedType}
          onChange={(e) => { setSelectedType(e.target.value); setSuccess(null); setError(null); }}
          className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] mb-3"
        >
          {TOPUP_TYPES.map((mt) => (
            <option key={mt.id} value={mt.id}>
              {mt.label}
            </option>
          ))}
        </select>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Number of children</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setKidsCount(Math.max(1, kidsCount - 1))}
              className="w-9 h-9 rounded-full border border-gray-300 text-gray-600 font-bold text-lg flex items-center justify-center hover:bg-gray-50"
            >
              -
            </button>
            <span className="font-bold text-gray-800 w-4 text-center">{kidsCount}</span>
            <button
              onClick={() => setKidsCount(Math.min(6, kidsCount + 1))}
              className="w-9 h-9 rounded-full border border-gray-300 text-gray-600 font-bold text-lg flex items-center justify-center hover:bg-gray-50"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* ── ADD SESSIONS / TOP UP — price updates when program/kids change above */}
      <div className="bg-white rounded-2xl p-5 shadow">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          Add Sessions / Top Up
        </p>

        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
            <p className="text-green-700 font-semibold text-sm">{success}</p>
            <button
              onClick={() => setSuccess(null)}
              className="text-gray-400 text-xs mt-2 underline"
            >
              Top up again
            </button>
          </div>
        ) : (
          <>
            {/* Dynamic price summary */}
            <div className="bg-[#ffe033]/25 border border-[#ffe033] rounded-xl px-4 py-2.5 flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600 font-medium">{selectedMt?.label}</span>
              <span className="font-fredoka text-xl text-[#1a56db]">{formatTHB(price)}</span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => doRegister("promptpay")}
                disabled={!!loading}
                className="w-full bg-[#1a56db] text-white font-bold text-base rounded-xl py-3.5 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading === "promptpay" ? "Processing…" : "Pay by PromptPay / QR Scan"}
              </button>

              <p className="text-center text-gray-300 text-xs">— or —</p>

              <button
                onClick={() => doRegister("cash")}
                disabled={!!loading}
                className="w-full border-2 border-green-500 text-green-600 font-bold text-base rounded-xl py-3.5 hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                {loading === "cash"
                  ? "Processing…"
                  : "Pay Cash at the Gym — tell staff when you arrive"}
              </button>

              <p className="text-center text-gray-300 text-xs">— or —</p>

              <button
                disabled
                className="w-full border border-gray-200 text-gray-400 font-semibold text-base rounded-xl py-3.5 cursor-not-allowed"
              >
                Pay by Credit / Debit Card
              </button>
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center mt-3">{error}</p>
            )}
          </>
        )}
      </div>

      {/* ── RECENT CHECK-INS ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 shadow">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          Recent Check-ins
        </p>
        {recentCheckIns.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-1">No check-ins recorded yet</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-50">
            {recentCheckIns.map((ci) => (
              <div key={ci.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">
                  {new Date(ci.check_in_at).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(ci.check_in_at).toLocaleTimeString("en-US", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

"use client";

import { useState, lazy, Suspense } from "react";
import Image from "next/image";

const StripePayment = lazy(() => import("@/components/public/StripePayment"));
import {
  MEMBERSHIP_TYPES,
  getPriceForType,
  calcBulkPrice,
  BASE_PRICES,
  formatTHB,
} from "@/lib/pricing";
import { useLanguage } from "@/lib/i18n/useLanguage";

interface CheckIn {
  id: number;
  check_in_at: string;
  notes: string | null;
  member_id?: number;
}

interface ActivePackage {
  id: number;
  membership_type: string;
  membership_label: string;
  sessions_remaining: number | null;
  created_at: string;
}

interface Props {
  memberId: number;
  memberName: string;
  memberPhone: string | null;
  memberEmail?: string | null;
  currentType: string;
  defaultKids: number;
  recentCheckIns: CheckIn[];
  activePackages?: ActivePackage[];
}

export default function TopUpSection({
  memberId,
  memberName,
  memberPhone,
  memberEmail,
  currentType,
  defaultKids,
  recentCheckIns,
  activePackages = [],
}: Props) {
  const { t } = useLanguage();

  const visibleTypes = MEMBERSHIP_TYPES.filter((m) => m.id !== "birthday_event");
  const safeInitial = visibleTypes.find((m) => m.id === currentType)
    ? currentType
    : visibleTypes[0].id;

  const [selectedType, setSelectedType] = useState(safeInitial);
  const [kidsCount, setKidsCount]       = useState(defaultKids);
  const [bulkQty, setBulkQty]           = useState(5); // default qty for bulk packs

  const [loading, setLoading]             = useState<string | null>(null);
  const [success, setSuccess]             = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [showPromptPay, setShowPromptPay] = useState(false);
  const [slip, setSlip]                   = useState<File | null>(null);
  const [stripeStep, setStripeStep]       = useState(false);
  const [pendingId, setPendingId]         = useState<number | null>(null);
  const [waterQty, setWaterQty]           = useState(0);

  const selectedMt = MEMBERSHIP_TYPES.find((m) => m.id === selectedType);
  const isBulk     = !!selectedMt?.bulk;
  const WATER_PRICE = 15;

  const basePrice = isBulk
    ? calcBulkPrice(BASE_PRICES[selectedMt!.bulkBase!] ?? 0, bulkQty)
    : getPriceForType(selectedType, kidsCount);
  const price = basePrice + waterQty * WATER_PRICE;

  const discountPct = isBulk ? Math.min(bulkQty, 20) : 0;

  async function compressImage(file: File, maxPx: number): Promise<File> {
    return new Promise((resolve) => {
      const img = document.createElement("img");
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file);
        }, "image/jpeg", 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function doRegister(paymentMethod: "cash" | "promptpay" | "stripe", slipFile?: File | null) {
    setLoading(paymentMethod);
    setError(null);

    const body = new FormData();
    body.append("name", memberName);
    if (memberPhone) body.append("phone", memberPhone);
    if (memberEmail) body.append("email", memberEmail);
    body.append("membership_type", selectedType);
    body.append("kids_count", String(kidsCount));
    body.append("payment_method", paymentMethod);
    body.append("amount_paid", String(price));
    if (!selectedMt?.timeBased) {
      body.append("sessions_remaining", isBulk ? String(bulkQty) : "1");
    }
    body.append("parent_member_id", String(memberId));
    const waterNote = waterQty > 0 ? ` | Water x${waterQty} (+${waterQty * WATER_PRICE} THB)` : "";
    body.append("notes", `Top-up from member card #${memberId}${waterNote}`);
    if (slipFile && slipFile.size > 0) {
      const compressed = await compressImage(slipFile, 1400);
      body.append("slip", compressed, slipFile.name);
    }

    try {
      const res  = await fetch("/api/members", { method: "POST", body });
      const data = await res.json();
      setLoading(null);
      if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }

      // Record water add-on sale (non-blocking)
      if (waterQty > 0) {
        fetch("/api/water-addon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qty: waterQty, member_name: memberName, reference_id: data.id }),
        }).catch(() => {});
        setWaterQty(0);
      }

      if (paymentMethod === "cash") {
        setSuccess(`Registered for ${selectedMt?.label}! ✅ Pay cash when you arrive. Staff will check you in.`);
      } else if (paymentMethod === "stripe") {
        setPendingId(data.id);
        setStripeStep(true);
      } else {
        // PromptPay submitted with slip
        setShowPromptPay(false);
        setSlip(null);
        setSuccess(`Payment slip submitted! ✅ Staff will approve your ${selectedMt?.label} shortly.`);
      }
    } catch {
      setLoading(null);
      setError("Something went wrong. Please try again.");
    }
  }

  // ── Stripe payment screen ─────────────────────────────────────────────────
  if (stripeStep && pendingId) {
    return (
      <div className="mt-4 flex flex-col gap-3">
        <div className="bg-white rounded-2xl p-5 shadow flex flex-col gap-4">
          <button onClick={() => setStripeStep(false)} className="text-gray-400 text-sm text-left underline">
            {t.back}
          </button>
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <span className="text-gray-600 text-sm">{selectedMt?.label}</span>
            <span className="font-fredoka text-2xl text-[#1a56db]">{formatTHB(price)}</span>
          </div>
          <Suspense fallback={<p className="text-gray-400 text-sm text-center py-4 animate-pulse">Loading...</p>}>
            <StripePayment
              amount={price}
              description={`NinjaGym top-up: ${selectedMt?.label}`}
              referenceId={pendingId}
              referenceType="member"
              onSuccess={() => setSuccess(`Payment confirmed! ✅ Your ${selectedMt?.label} has been added.`)}
              onError={(msg) => setError(msg)}
            />
          </Suspense>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        </div>
      </div>
    );
  }

  // ── PromptPay payment screen ───────────────────────────────────────────────
  if (showPromptPay) {
    return (
      <div className="mt-4 flex flex-col gap-3">
        <div className="bg-white rounded-2xl p-5 shadow flex flex-col gap-4">
          <button
            onClick={() => { setShowPromptPay(false); setSlip(null); setError(null); }}
            className="text-gray-400 text-sm text-left underline"
          >
            {t.back}
          </button>
          <div className="text-center">
            <p className="text-xs font-bold text-[#1a56db] uppercase tracking-wide mb-3">{t.payPromptPay}</p>
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
            <p className="text-xs font-bold text-[#1a56db] uppercase tracking-wide mb-0.5">{t.payingFor}</p>
            <p className="font-fredoka text-2xl text-[#1a56db]">{formatTHB(price)}</p>
            {isBulk && (
              <p className="text-xs text-[#1a56db]/70 mt-0.5">
                {bulkQty} {t.sessions} · {discountPct}% off
              </p>
            )}
          </div>
          {/* Slip upload */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Upload Payment Slip <span className="text-gray-400 font-normal">(screenshot of transfer confirmation)</span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSlip(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#1a56db] file:text-white file:font-semibold"
            />
            {slip && (
              <p className="text-xs text-green-600 mt-1">Selected: {slip.name}</p>
            )}
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            onClick={() => doRegister("promptpay", slip)}
            disabled={!!loading || !slip}
            className="w-full bg-[#1a56db] text-white font-bold text-base rounded-xl py-3.5 hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading === "promptpay" ? "Submitting…" : "Submit Payment Slip →"}
          </button>
          <p className="text-xs text-gray-400 text-center">Staff will approve your session after verifying the transfer.</p>
        </div>
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────
  return (
    <div className="mt-4 flex flex-col gap-3">

      {/* ── CONTINUE TRAINING ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 shadow">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
          {t.continueTraining}
        </p>
        <p className="text-sm text-gray-500 mb-3">{t.continueTrainingHint}</p>

        {/* Program picker */}
        <select
          value={selectedType}
          onChange={(e) => { setSelectedType(e.target.value); setSuccess(null); setError(null); }}
          className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] mb-3"
        >
          {MEMBERSHIP_TYPES.filter((mt) => mt.id !== "birthday_event").map((mt) => (
            <option key={mt.id} value={mt.id}>{mt.label}</option>
          ))}
        </select>

        {/* Bulk qty slider — appears only for bulk types */}
        {isBulk && (
          <div className="bg-blue-50 border border-[#1a56db]/20 rounded-xl px-4 py-3 mb-3">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-semibold text-gray-700">{bulkQty} {t.sessions}</span>
              <span className="text-green-600 font-bold">{discountPct}% off</span>
            </div>
            <input
              type="range"
              min={5}
              max={20}
              value={bulkQty}
              onChange={(e) => setBulkQty(Number(e.target.value))}
              className="w-full accent-[#1a56db]"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>5 {t.sessions} (5% off)</span>
              <span>20 {t.sessions} (20% off)</span>
            </div>
          </div>
        )}

        {/* Kids count — not shown for bulk (bulk packs are per-pack, not per-kid) */}
        {!isBulk && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{t.numChildren}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setKidsCount(Math.max(1, kidsCount - 1))}
                className="w-9 h-9 rounded-full border border-gray-300 text-gray-600 font-bold text-lg flex items-center justify-center hover:bg-gray-50"
              >
                -
              </button>
              <span className="font-bold text-gray-800 w-4 text-center">{kidsCount}</span>
              <button
                onClick={() => setKidsCount(Math.min(10, kidsCount + 1))}
                className="w-9 h-9 rounded-full border border-gray-300 text-gray-600 font-bold text-lg flex items-center justify-center hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── ADD SESSIONS / TOP UP — payment buttons + live price ────────────── */}
      <div className="bg-white rounded-2xl p-5 shadow">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          {t.addSessions}
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
            {/* Water add-on */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">💧</span>
                <span className="text-sm font-semibold text-gray-700">Add Water</span>
                <span className="text-xs text-gray-400">{formatTHB(WATER_PRICE)} each</span>
              </div>
              <div className="flex items-center gap-2">
                {waterQty > 0 && (
                  <button type="button" onClick={() => setWaterQty(Math.max(0, waterQty - 1))} className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center hover:bg-gray-200">−</button>
                )}
                <span className="text-sm font-bold text-gray-700 w-5 text-center">{waterQty}</span>
                <button type="button" onClick={() => setWaterQty(Math.min(10, waterQty + 1))} className="w-7 h-7 rounded-full bg-[#1a56db] text-white font-bold text-sm flex items-center justify-center hover:bg-blue-700">+</button>
              </div>
            </div>

            {/* Live price summary */}
            <div className="bg-[#ffe033]/25 border border-[#ffe033] rounded-xl px-4 py-2.5 flex items-center justify-between mb-3">
              <div>
                <span className="text-sm text-gray-600 font-medium">{selectedMt?.label}</span>
                {isBulk && (
                  <span className="text-xs text-gray-400 ml-2">· {bulkQty} sessions</span>
                )}
              </div>
              <span className="font-fredoka text-xl text-[#1a56db]">{formatTHB(price)}</span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setShowPromptPay(true); setError(null); }}
                disabled={!!loading}
                className="w-full bg-[#1a56db] text-white font-bold text-base rounded-xl py-3.5 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {t.payPromptPay}
              </button>

              <p className="text-center text-gray-300 text-xs">{t.or}</p>

              <button
                onClick={() => doRegister("cash")}
                disabled={!!loading}
                className="w-full border-2 border-green-500 text-green-600 font-bold text-base rounded-xl py-3.5 hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                {loading === "cash" ? t.submitting : t.payCashGym}
              </button>

              {/* Credit card — re-enable when needed
              <p className="text-center text-gray-300 text-xs">{t.or}</p>
              <button
                onClick={() => doRegister("stripe")}
                disabled={!!loading}
                className="w-full border border-gray-300 text-gray-600 font-semibold text-base rounded-xl py-3.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loading === "stripe" ? t.submitting : t.payCardDisabled}
              </button>
              */}
            </div>

            {error && <p className="text-red-500 text-sm text-center mt-3">{error}</p>}
          </>
        )}
      </div>

      {/* ── RECENT CHECK-INS ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 shadow">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          {t.recentCheckIns}
        </p>
        {recentCheckIns.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-1">{t.noCheckIns}</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-50">
            {recentCheckIns.map((ci) => {
              // If check-in is against a top-up registration, show which program
              const pkg = ci.member_id
                ? activePackages.find((p) => p.id === ci.member_id)
                : null;
              return (
                <div key={ci.id} className="flex items-center justify-between py-2 gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm text-gray-700">
                      {new Date(ci.check_in_at).toLocaleDateString("en-US", {
                        timeZone: "Asia/Bangkok", month: "short", day: "numeric", year: "numeric",
                      })}
                    </span>
                    {pkg && (
                      <span className="text-xs text-[#1a56db] truncate">{pkg.membership_label}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(ci.check_in_at).toLocaleTimeString("en-US", {
                      timeZone: "Asia/Bangkok", hour: "numeric", minute: "2-digit", hour12: true,
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

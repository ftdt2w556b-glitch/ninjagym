"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const StripePayment = lazy(() => import("@/components/public/StripePayment"));
import {
  MEMBERSHIP_TYPES,
  getPriceForType,
  calcBulkPrice,
  BASE_PRICES,
  formatTHB,
} from "@/lib/pricing";
import { useLanguage } from "@/lib/i18n/useLanguage";

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
  activePackages?: ActivePackage[];
  loyaltyDiscount?: number;
  prices?: Record<string, number>; // live prices from DB settings (falls back to BASE_PRICES)
  descriptions?: Record<string, string>; // live descriptions from DB settings (falls back to mt.note)
  cardToken?: string; // needed for parent-initiated cancel
  dbPendingTopUp?: { id: number; membership_label: string; amount_paid: number | null; payment_method: string | null } | null;
}

export default function TopUpSection({
  memberId,
  memberName,
  memberPhone,
  memberEmail,
  currentType,
  defaultKids,
  activePackages = [],
  loyaltyDiscount = 0,
  prices,
  descriptions,
  cardToken,
  dbPendingTopUp,
}: Props) {
  const { t } = useLanguage();

  const visibleTypes = MEMBERSHIP_TYPES.filter((m) => m.id !== "birthday_event");
  const safeInitial = visibleTypes.find((m) => m.id === currentType)
    ? currentType
    : visibleTypes[0].id;

  const [selectedType, setSelectedType] = useState(safeInitial);
  const [kidsCount, setKidsCount]       = useState(defaultKids);
  const [kidsNames, setKidsNames]       = useState("");
  const [bulkQty, setBulkQty]           = useState(5); // default qty for bulk packs

  const [loading, setLoading]             = useState<string | null>(null);
  const [success, setSuccess]             = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [showPromptPay, setShowPromptPay] = useState(false);
  const [slip, setSlip]                   = useState<File | null>(null);
  const [stripeStep, setStripeStep]       = useState(false);
  const [pendingId, setPendingId]         = useState<number | null>(null);
  const [waterQty, setWaterQty]           = useState(0);

  // Detect an in-flight PromptPay purchase awaiting staff approval (survives page refresh)
  // Uses localStorage (persists across tabs/restarts) + DB verification on mount
  // Initialise from server-fetched DB pending so banner shows on any device, first visit
  const [pendingPurchase, setPendingPurchase] = useState<{
    label: string; amount: number | null; method: string | null; regId?: number;
  } | null>(dbPendingTopUp ? {
    label:  dbPendingTopUp.membership_label,
    amount: dbPendingTopUp.amount_paid,
    method: dbPendingTopUp.payment_method,
    regId:  dbPendingTopUp.id,
  } : null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const SESSION_KEY = `pending_topup_${memberId}`;

  useEffect(() => {
    let stored: { regId: number; label: string; amount: number; method: string } | null = null;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch { /* ignore */ }
    if (!stored) return;

    const supabase = createSupabaseBrowserClient();

    if (stored.method === "cash") {
      // Cash: verify still cash_pending in member_registrations
      supabase
        .from("member_registrations")
        .select("id, slip_status")
        .eq("id", stored.regId)
        .eq("slip_status", "cash_pending")
        .maybeSingle()
        .then(({ data: reg }) => {
          if (!reg) {
            // Already processed at POS or cancelled — clear storage
            localStorage.removeItem(SESSION_KEY);
            return;
          }
          setPendingPurchase({ label: stored!.label, amount: stored!.amount, method: stored!.method, regId: stored!.regId });

          // Auto-clear when POS approves (realtime on member_registrations)
          const channel = supabase
            .channel(`cash-pending-${stored!.regId}`)
            .on("postgres_changes", {
              event: "UPDATE", schema: "public",
              table: "member_registrations", filter: `id=eq.${stored!.regId}`,
            }, (payload) => {
              const updated = payload.new as { slip_status: string };
              if (updated.slip_status !== "cash_pending") {
                localStorage.removeItem(SESSION_KEY);
                setPendingPurchase(null);
              }
            })
            .subscribe();
          return () => { supabase.removeChannel(channel); };
        });
    } else {
      // PromptPay: verify still pending via pending_checkins (has public SELECT RLS)
      supabase
        .from("pending_checkins")
        .select("id, status")
        .eq("member_id", stored.regId)
        .eq("status", "pending")
        .maybeSingle()
        .then(({ data: pending }) => {
          if (!pending) {
            // Already approved/rejected — clear storage and don't block form
            localStorage.removeItem(SESSION_KEY);
            return;
          }
          setPendingPurchase({ label: stored!.label, amount: stored!.amount, method: stored!.method, regId: stored!.regId });

          // Auto-clear when staff approves/rejects (realtime)
          const channel = supabase
            .channel(`topup-pending-${pending.id}`)
            .on("postgres_changes", {
              event: "UPDATE", schema: "public",
              table: "pending_checkins", filter: `id=eq.${pending.id}`,
            }, (payload) => {
              const updated = payload.new as { status: string };
              if (updated.status !== "pending") {
                localStorage.removeItem(SESSION_KEY);
                setPendingPurchase(null);
              }
            })
            .subscribe();
          return () => { supabase.removeChannel(channel); };
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  const selectedMt = MEMBERSHIP_TYPES.find((m) => m.id === selectedType);
  const isBulk     = !!selectedMt?.bulk;
  const WATER_PRICE = 15;

  const livePrice = prices ?? BASE_PRICES;
  const basePrice = isBulk
    ? calcBulkPrice(livePrice[`price_${selectedMt!.bulkBase!}`] ?? BASE_PRICES[selectedMt!.bulkBase!] ?? 0, bulkQty, livePrice)
    : getPriceForType(selectedType, kidsCount, livePrice);
  const discountedBase = Math.max(0, basePrice - loyaltyDiscount);
  const price = discountedBase + waterQty * WATER_PRICE;

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
    if (!isBulk && !kidsNames.trim()) {
      setError("Please enter the kids names before continuing.");
      return;
    }
    setLoading(paymentMethod);
    setError(null);

    const body = new FormData();
    body.append("name", memberName);
    if (memberPhone) body.append("phone", memberPhone);
    if (memberEmail) body.append("email", memberEmail);
    body.append("membership_type", selectedType);
    body.append("kids_count", String(kidsCount));
    if (kidsNames.trim()) body.append("kids_names", kidsNames.trim());
    body.append("payment_method", paymentMethod);
    body.append("amount_paid", String(price));
    if (!selectedMt?.timeBased) {
      // Bulk packs track total sessions purchased; single sessions track per-kid (kidsCount)
      body.append("sessions_remaining", isBulk ? String(bulkQty) : String(kidsCount));
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
          body: JSON.stringify({ qty: waterQty, member_name: memberName, reference_id: data.id, payment_method: paymentMethod }),
        }).catch(() => {});
        setWaterQty(0);
      }

      if (paymentMethod === "cash") {
        // Store in localStorage so the pending state survives page refresh
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          regId: data.id,
          label: selectedMt?.label ?? selectedType,
          amount: price,
          method: "cash",
        }));
        setSuccess(`Registered for ${selectedMt?.label}! ✅ Pay cash when you arrive. Staff will check you in.`);
      } else if (paymentMethod === "stripe") {
        setPendingId(data.id);
        setStripeStep(true);
      } else {
        // PromptPay submitted with slip — store in localStorage so page refresh shows pending state
        localStorage.setItem(SESSION_KEY, JSON.stringify({
          regId: data.id,
          label: selectedMt?.label ?? selectedType,
          amount: price,
          method: paymentMethod,
        }));
        setShowPromptPay(false);
        setSlip(null);
        setSuccess(`Payment slip submitted! ✅ Staff will approve your ${selectedMt?.label} shortly.`);
      }
    } catch {
      setLoading(null);
      setError("Something went wrong. Please try again.");
    }
  }

  // ── Pending purchase (PromptPay awaiting staff approval) — survives page refresh ──
  async function cancelPending() {
    if (!pendingPurchase?.regId || !cardToken) {
      // No API call possible — just clear locally so parent can resubmit
      localStorage.removeItem(SESSION_KEY);
      setPendingPurchase(null);
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch("/api/checkin/cancel-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reg_id: pendingPurchase.regId, parent_member_id: memberId, token: cardToken }),
      });
      const data = await res.json();
      if (!res.ok) { setCancelError(data.error ?? "Could not cancel. Ask staff to reject it."); return; }
      localStorage.removeItem(SESSION_KEY);
      setPendingPurchase(null);
    } finally {
      setCancelling(false);
    }
  }

  if (pendingPurchase && !success) {
    const isCashPending = pendingPurchase.method === "cash";
    return (
      <div className="mt-4 bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 flex flex-col gap-3">
        <div className="text-center">
          <p className="text-2xl mb-1">{isCashPending ? "💵" : "⏳"}</p>
          <p className="font-bold text-amber-800 text-lg">
            {isCashPending ? "Cash payment pending" : "Payment slip submitted"}
          </p>
          <p className="text-amber-700 text-sm">{pendingPurchase.label}</p>
          {pendingPurchase.amount != null && (
            <p className="text-amber-600 text-sm">฿{pendingPurchase.amount.toLocaleString()}</p>
          )}
          <p className="text-gray-500 text-xs mt-2">
            {isCashPending
              ? "Tell staff when you arrive — they will collect payment and check you in."
              : "Staff will approve your slip shortly."}
          </p>
        </div>
        {cancelError && <p className="text-red-500 text-xs text-center">{cancelError}</p>}
        <button
          onClick={cancelPending}
          disabled={cancelling}
          className="w-full py-2.5 rounded-xl border-2 border-amber-400 text-amber-800 font-semibold text-sm hover:bg-amber-100 transition-colors disabled:opacity-50"
        >
          {cancelling ? "Cancelling…" : isCashPending ? "✕ Cancel this registration" : "✕ Wrong program or slip? Cancel and resubmit"}
        </button>
      </div>
    );
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
            {loyaltyDiscount > 0 && (
              <p className="text-xs text-[#1a56db]/60 line-through mb-0.5">{formatTHB(basePrice)}</p>
            )}
            <p className="font-fredoka text-2xl text-[#1a56db]">{formatTHB(price)}</p>
            {loyaltyDiscount > 0 && (
              <p className="text-xs font-bold text-green-700 mt-0.5">⭐ Loyalty discount −{formatTHB(loyaltyDiscount)}</p>
            )}
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
          className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] mb-2"
        >
          {MEMBERSHIP_TYPES.filter((mt) => mt.id !== "birthday_event").map((mt) => (
            <option key={mt.id} value={mt.id}>{mt.label}</option>
          ))}
        </select>

        {/* Selected program description — from DB if admin set it, fallback to hardcoded note */}
        {(descriptions?.[`desc_${selectedType}`] ?? selectedMt?.note) && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 mb-3 leading-relaxed">
            ℹ️ {descriptions?.[`desc_${selectedType}`] ?? selectedMt?.note}
          </p>
        )}

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

        {/* Kids count + names — not shown for bulk (bulk packs are per-pack, not per-kid) */}
        {!isBulk && (
          <div className="flex flex-col gap-3">
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
            <input
              type="text"
              value={kidsNames}
              onChange={(e) => { setKidsNames(e.target.value); if (error) setError(null); }}
              placeholder="Kids names, e.g. Nami, Luffy ✱ required"
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] text-gray-700 ${!kidsNames.trim() ? "border-orange-300 bg-orange-50" : "border-gray-200"}`}
            />
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
                {loyaltyDiscount > 0 && (
                  <span className="ml-2 text-xs font-bold text-green-600">⭐ −{formatTHB(loyaltyDiscount)}</span>
                )}
              </div>
              <div className="flex flex-col items-end">
                {loyaltyDiscount > 0 && (
                  <span className="text-xs text-gray-400 line-through">{formatTHB(basePrice)}</span>
                )}
                <span className="font-fredoka text-xl text-[#1a56db]">{formatTHB(price)}</span>
              </div>
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


    </div>
  );
}

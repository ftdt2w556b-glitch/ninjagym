"use client";

import { useState, useEffect, useCallback } from "react";
import { MEMBERSHIP_TYPES, BASE_PRICES, getPriceForType } from "@/lib/pricing";

// Walk-in relevant types only (no bulk, no birthday_event)
const WALKIN_TYPES = MEMBERSHIP_TYPES.filter(
  (m) => !m.bulk && m.id !== "birthday_event"
);

interface MemberResult {
  id: number;
  name: string;
  membership_type: string;
  slip_status: string;
  sessions_remaining: number | null;
  expires_at: string | null;
  kids_names: string | null;
  kids_count: number;
}

interface QuickRegResult {
  id: number;
  name: string;
  checked_in: boolean;
  sessions_remaining: number | null;
  slip_status: string;
}

const DEFAULT_FORM = {
  staffName: "",
  name: "",
  kidsNames: "",
  kidsCount: 1,
  membershipType: "session_group",
  paymentMethod: "cash" as "cash" | "promptpay",
  amount: BASE_PRICES["price_session_group"] ?? 350,
  notes: "",
};

export default function ScannerClient({ staffNames }: { staffNames: string[] }) {
  // ── PIN state ──────────────────────────────────────────────────────
  const [digits, setDigits]               = useState<string[]>([]);
  const [member, setMember]               = useState<MemberResult | null>(null);
  const [lookupError, setLookupError]     = useState("");
  const [loading, setLoading]             = useState(false);
  const [checkedIn, setCheckedIn]         = useState(false);
  const [sessionsLeft, setSessionsLeft]   = useState<number | null>(null);
  const [shake, setShake]                 = useState(false);

  // ── Quick register state ──────────────────────────────────────────
  const [showModal, setShowModal]         = useState(false);
  const [form, setForm]                   = useState(DEFAULT_FORM);
  const [qrLoading, setQrLoading]         = useState(false);
  const [qrError, setQrError]             = useState("");
  const [qrResult, setQrResult]           = useState<QuickRegResult | null>(null);

  // Auto-recalculate amount when type or kids count changes
  useEffect(() => {
    const price = getPriceForType(form.membershipType, form.kidsCount);
    setForm((f) => ({ ...f, amount: price }));
  }, [form.membershipType, form.kidsCount]);

  // ── PIN lookup ────────────────────────────────────────────────────
  const lookupByPin = useCallback(async (pin: string) => {
    setLoading(true);
    setLookupError("");
    setMember(null);
    setCheckedIn(false);
    setSessionsLeft(null);

    try {
      const res = await fetch(`/api/scanner/lookup?pin=${encodeURIComponent(pin)}`);
      const data = await res.json();
      if (!res.ok || !data) {
        triggerError();
        return;
      }
      setMember(data);
    } catch {
      triggerError();
    } finally {
      setLoading(false);
    }
  }, []);

  function triggerError() {
    setShake(true);
    setLookupError("PIN not found");
    setTimeout(() => {
      setShake(false);
      setLookupError("");
      setDigits([]);
    }, 1800);
  }

  // ── Numpad input ──────────────────────────────────────────────────
  function pressDigit(d: string) {
    if (loading || member) return;
    if (digits.length >= 4) return;
    const next = [...digits, d];
    setDigits(next);
    if (next.length === 4) {
      lookupByPin(next.join(""));
    }
  }

  function pressBackspace() {
    if (loading || member) return;
    setDigits((prev) => prev.slice(0, -1));
    setLookupError("");
  }

  function pressClear() {
    if (loading || member) return;
    setDigits([]);
    setLookupError("");
  }

  function resetToNumpad() {
    setMember(null);
    setCheckedIn(false);
    setSessionsLeft(null);
    setDigits([]);
    setLookupError("");
  }

  // ── Check in ─────────────────────────────────────────────────────
  async function handleCheckIn() {
    if (!member) return;
    setLoading(true);

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ member_id: member.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSessionsLeft(data.sessions_remaining);
      setCheckedIn(true);

      // Auto-reset after 4 seconds
      setTimeout(() => resetToNumpad(), 4000);
    } catch (err: unknown) {
      setLookupError(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setLoading(false);
    }
  }

  // ── Quick register ────────────────────────────────────────────────
  function openModal() {
    setQrResult(null);
    setQrError("");
    setForm((f) => ({ ...DEFAULT_FORM, staffName: f.staffName }));
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setQrResult(null);
    setQrError("");
  }

  async function handleQuickRegister() {
    if (!form.staffName) { setQrError("Please select the staff member on duty."); return; }
    if (!form.name.trim()) { setQrError("Parent / guardian name is required."); return; }
    if (!form.kidsNames.trim()) { setQrError("Kids names are required — staff need this to find the right child."); return; }

    setQrLoading(true);
    setQrError("");

    try {
      const res = await fetch("/api/quick-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          kids_names: form.kidsNames.trim() || null,
          kids_count: form.kidsCount,
          membership_type: form.membershipType,
          payment_method: form.paymentMethod,
          amount_paid: form.amount,
          notes: form.notes.trim(),
          staff_name: form.staffName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQrResult(data);
      setTimeout(() => closeModal(), 6000);
    } catch (err: unknown) {
      setQrError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setQrLoading(false);
    }
  }

  // ── Membership helpers ────────────────────────────────────────────
  const membershipLabel = member
    ? MEMBERSHIP_TYPES.find((m) => m.id === member.membership_type)?.label ?? member.membership_type
    : "";

  const isSessionBased = member && member.sessions_remaining !== null;
  const isMonthlyFlex = member?.membership_type === "monthly_flex";
  const expiryDate = member?.expires_at ? new Date(member.expires_at) : null;
  const now = new Date();
  const isExpired = expiryDate ? expiryDate < now : false;
  const daysLeft = expiryDate
    ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpiringSoon = daysLeft !== null && daysLeft <= 7 && daysLeft > 0;
  const isPaymentPending = member && member.slip_status !== "approved";

  const selectedType = WALKIN_TYPES.find((m) => m.id === form.membershipType);

  // ── Numpad layout ─────────────────────────────────────────────────
  const numpadKeys = ["1","2","3","4","5","6","7","8","9","CLR","0","⌫"];

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-900 min-h-dvh flex flex-col items-center justify-start pt-10 px-4 pb-24">

      <h1 className="text-white font-fredoka text-5xl mb-1 text-center tracking-wide">NinjaGym</h1>
      <p className="text-gray-400 text-sm mb-6 text-center">Enter your PIN to check in</p>

      {/* Gate policy banner */}
      <div className="w-full max-w-sm bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-4 py-2.5 mb-8 text-center">
        <p className="text-yellow-300 text-xs font-semibold">
          🚦 Every child entering must be registered
        </p>
      </div>

      {/* ── Checked in success ── */}
      {checkedIn && member && (
        <div className="w-full max-w-sm bg-green-500 text-white rounded-2xl p-6 text-center shadow-xl">
          <div className="text-6xl mb-3">✓</div>
          <h2 className="font-fredoka text-3xl mb-1">{member.name}</h2>
          <p className="text-green-100 mb-3">Checked in!</p>
          {isSessionBased && sessionsLeft !== null && (
            <div className="bg-white/20 rounded-xl px-4 py-3">
              {sessionsLeft > 0 ? (
                <p className="text-white font-bold">
                  {sessionsLeft} session{sessionsLeft !== 1 ? "s" : ""} remaining
                </p>
              ) : (
                <p className="text-yellow-200 font-bold">Last session used. Remind to renew!</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Member found, not yet checked in ── */}
      {member && !checkedIn && (
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">

          {isMonthlyFlex && isExpired && (
            <div className="bg-red-100 text-red-700 rounded-xl px-3 py-2 mb-4 text-sm font-semibold text-center">
              Monthly membership expired. Renewal required.
            </div>
          )}
          {isMonthlyFlex && isExpiringSoon && (
            <div className="bg-orange-100 text-orange-700 rounded-xl px-3 py-2 mb-4 text-sm text-center">
              Membership expires in <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong>. Remind to renew!
            </div>
          )}
          {isPaymentPending && (
            <div className="bg-orange-100 text-orange-700 rounded-xl px-3 py-2 mb-4 text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>Payment pending. See staff.</span>
            </div>
          )}

          <h2 className="font-fredoka text-2xl text-gray-900 mb-1">{member.name}</h2>
          <p className="text-gray-500 text-sm mb-1">{membershipLabel}</p>
          {member.kids_names && (
            <p className="text-xs text-gray-400 mb-1">Kids: {member.kids_names}</p>
          )}

          {isSessionBased && member.sessions_remaining !== null && (
            <div className={`rounded-xl px-3 py-2 my-3 text-center ${
              member.sessions_remaining <= 1 ? "bg-orange-50 border border-orange-200" : "bg-blue-50"
            }`}>
              <p className="text-xs text-gray-500">Sessions Remaining</p>
              <p className={`font-fredoka text-3xl ${member.sessions_remaining <= 1 ? "text-orange-500" : "text-[#1a56db]"}`}>
                {member.sessions_remaining}
              </p>
              {member.sessions_remaining <= 1 && (
                <p className="text-xs text-orange-500 font-medium">Almost out. Suggest renewal!</p>
              )}
            </div>
          )}

          {isMonthlyFlex && expiryDate && !isExpired && (
            <div className="bg-blue-50 rounded-xl px-3 py-2 my-3 text-center">
              <p className="text-xs text-gray-500">Membership Valid Until</p>
              <p className="font-fredoka text-xl text-[#1a56db]">
                {expiryDate.toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          )}

          <button
            onClick={handleCheckIn}
            disabled={loading || (isMonthlyFlex && isExpired) || !!isPaymentPending}
            className="w-full bg-[#22c55e] text-white font-bold text-xl py-4 rounded-2xl hover:bg-green-500 transition-colors disabled:opacity-50 mt-3"
          >
            {loading ? "Checking in..." : "✓ Check In"}
          </button>

          <button
            onClick={resetToNumpad}
            className="w-full text-gray-400 text-sm mt-3 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── PIN numpad ── */}
      {!member && !checkedIn && (
        <div className="w-full max-w-xs flex flex-col items-center gap-6">

          {/* PIN dots */}
          <div className="flex gap-4">
            {[0,1,2,3].map((i) => {
              const filled = i < digits.length;
              return (
                <div
                  key={i}
                  className={`w-5 h-5 rounded-full transition-all duration-150 ${
                    shake
                      ? "bg-red-500"
                      : filled
                      ? "bg-[#ffe033]"
                      : "bg-gray-600"
                  }`}
                />
              );
            })}
          </div>

          {/* Error message */}
          {lookupError && !shake && (
            <p className="text-red-400 text-sm">{lookupError}</p>
          )}

          {/* Loading spinner */}
          {loading && (
            <div className="flex items-center gap-2 text-gray-400">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <span className="text-sm">Looking up...</span>
            </div>
          )}

          {/* Numpad grid */}
          {!loading && (
            <div className="grid grid-cols-3 gap-3 w-full">
              {numpadKeys.map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === "⌫") pressBackspace();
                    else if (key === "CLR") pressClear();
                    else pressDigit(key);
                  }}
                  className={`bg-gray-700 text-white font-bold text-2xl py-5 rounded-2xl active:scale-95 transition-all select-none ${
                    key === "CLR" || key === "⌫"
                      ? "text-gray-300 text-lg"
                      : "hover:bg-gray-600"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Quick Register FAB ── */}
      <button
        onClick={openModal}
        className="fixed bottom-6 right-6 bg-green-500 text-white font-bold px-5 py-3 rounded-2xl shadow-xl hover:bg-green-400 active:scale-95 transition-all text-sm flex items-center gap-2 z-40"
      >
        <span className="text-xl leading-none">+</span> Quick Register
      </button>

      {/* ── Quick Register Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-3">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">

            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-700">
              <h2 className="text-white font-fredoka text-2xl">Quick Register</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-white text-2xl leading-none">✕</button>
            </div>

            {qrResult ? (
              <div className={`m-5 rounded-2xl p-6 text-center ${qrResult.checked_in ? "bg-green-500" : "bg-blue-600"} text-white`}>
                <div className="text-5xl mb-3">{qrResult.checked_in ? "✓" : "⏳"}</div>
                <h3 className="font-fredoka text-2xl mb-1">{qrResult.name}</h3>
                {qrResult.checked_in ? (
                  <>
                    <p className="text-green-100 mb-2">Registered and checked in!</p>
                    <p className="text-xs text-green-200">Cash recorded · Drawer logged</p>
                  </>
                ) : (
                  <>
                    <p className="text-blue-100 mb-2">Registered. Payment pending.</p>
                    <p className="text-xs text-blue-200">Ask them to transfer via PromptPay and show the slip. Staff will approve in Payments.</p>
                  </>
                )}
                <p className="text-xs opacity-60 mt-3">Closing in a moment...</p>
              </div>
            ) : (
              <div className="p-5 flex flex-col gap-4">

                {qrError && (
                  <div className="bg-red-900/50 text-red-300 rounded-xl px-4 py-3 text-sm">
                    {qrError}
                  </div>
                )}

                {/* Staff on duty */}
                <div>
                  <label className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1 block">
                    Staff on duty <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.staffName}
                    onChange={(e) => setForm((f) => ({ ...f, staffName: e.target.value }))}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
                  >
                    <option value="">Select staff</option>
                    {staffNames.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                {/* Parent name */}
                <div>
                  <label className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1 block">
                    Parent / Guardian name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Somchai Jaidee"
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1a56db] placeholder-gray-500"
                  />
                </div>

                {/* Kids names */}
                <div>
                  <label className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1 block">
                    Kids names <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.kidsNames}
                    onChange={(e) => setForm((f) => ({ ...f, kidsNames: e.target.value }))}
                    placeholder="e.g. Leo, Mia"
                    className={`w-full bg-gray-800 text-white border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1a56db] placeholder-gray-500 ${
                      !form.kidsNames.trim() ? "border-red-500" : "border-gray-600"
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Required — helps staff find the right child quickly</p>
                </div>

                {/* Kids count */}
                <div>
                  <label className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1 block">
                    Number of kids
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, kidsCount: Math.max(1, f.kidsCount - 1) }))}
                      className="w-11 h-11 bg-gray-700 text-white rounded-xl text-xl font-bold hover:bg-gray-600 transition-colors"
                    >
                      −
                    </button>
                    <span className="text-white font-fredoka text-2xl w-8 text-center">{form.kidsCount}</span>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, kidsCount: f.kidsCount + 1 }))}
                      className="w-11 h-11 bg-gray-700 text-white rounded-xl text-xl font-bold hover:bg-gray-600 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Session type */}
                <div>
                  <label className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1 block">
                    Session type
                  </label>
                  <select
                    value={form.membershipType}
                    onChange={(e) => setForm((f) => ({ ...f, membershipType: e.target.value }))}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
                  >
                    {WALKIN_TYPES.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  {selectedType?.note && (
                    <p className="text-gray-500 text-xs mt-1">{selectedType.note}</p>
                  )}
                </div>

                {/* Payment method */}
                <div>
                  <label className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1 block">
                    Payment method
                  </label>
                  <div className="flex gap-2">
                    {(["cash", "promptpay"] as const).map((pm) => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, paymentMethod: pm }))}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${
                          form.paymentMethod === pm
                            ? pm === "cash" ? "bg-green-500 text-white" : "bg-blue-600 text-white"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                      >
                        {pm === "cash" ? "💵 Cash" : "📱 PromptPay"}
                      </button>
                    ))}
                  </div>
                  {form.paymentMethod === "promptpay" && (
                    <p className="text-blue-400 text-xs mt-1">PromptPay: member will be pending until slip is approved.</p>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1 block">
                    Amount (฿)
                  </label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1a56db] font-fredoka text-xl"
                  />
                  <p className="text-gray-500 text-xs mt-1">Auto-calculated · edit if needed (e.g. discount)</p>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1 block">
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. first visit, discount applied"
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1a56db] placeholder-gray-500"
                  />
                </div>

                {/* Summary */}
                <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-300 flex justify-between">
                  <span>Total</span>
                  <span className="text-white font-bold font-fredoka text-lg">฿{form.amount.toLocaleString()}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-3 bg-gray-700 text-gray-300 rounded-xl font-bold hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickRegister}
                    disabled={qrLoading}
                    className={`flex-1 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 ${
                      form.paymentMethod === "cash"
                        ? "bg-green-500 hover:bg-green-400 text-white"
                        : "bg-blue-600 hover:bg-blue-500 text-white"
                    }`}
                  >
                    {qrLoading
                      ? "Registering..."
                      : form.paymentMethod === "cash"
                        ? "✓ Register & Check In"
                        : "Register →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

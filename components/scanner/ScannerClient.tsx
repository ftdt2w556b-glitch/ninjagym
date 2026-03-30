"use client";

import { useState, useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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
  email: string | null;
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
  // ── Scanner state ─────────────────────────────────────────────────
  const [manualId, setManualId]           = useState("");
  const [member, setMember]               = useState<MemberResult | null>(null);
  const [error, setError]                 = useState("");
  const [checkedIn, setCheckedIn]         = useState(false);
  const [sessionsLeft, setSessionsLeft]   = useState<number | null>(null);
  const [loading, setLoading]             = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Quick register state ──────────────────────────────────────────
  const [showModal, setShowModal]         = useState(false);
  const [form, setForm]                   = useState(DEFAULT_FORM);
  const [qrLoading, setQrLoading]         = useState(false);
  const [qrError, setQrError]             = useState("");
  const [qrResult, setQrResult]           = useState<QuickRegResult | null>(null);

  // ── Scanner bootstrap ─────────────────────────────────────────────
  useEffect(() => {
    inputRef.current?.focus();
    const params = new URLSearchParams(window.location.search);
    const memberId = params.get("member");
    if (memberId) lookupMember(memberId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-recalculate amount when type or kids count changes
  useEffect(() => {
    const price = getPriceForType(form.membershipType, form.kidsCount);
    setForm((f) => ({ ...f, amount: price }));
  }, [form.membershipType, form.kidsCount]);

  // ── Scanner functions ─────────────────────────────────────────────
  async function lookupMember(id: string) {
    setLoading(true);
    setError("");
    setMember(null);
    setCheckedIn(false);
    setSessionsLeft(null);

    const supabase = createSupabaseBrowserClient();
    const { data, error: dbError } = await supabase
      .from("member_registrations")
      .select("id, name, email, membership_type, slip_status, sessions_remaining, expires_at, kids_names, kids_count")
      .eq("id", id)
      .single();

    setLoading(false);
    if (dbError || !data) {
      setError(`Member #${id} not found.`);
      return;
    }
    setMember(data);
  }

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setLoading(false);
    }

    setTimeout(() => {
      setMember(null);
      setCheckedIn(false);
      setSessionsLeft(null);
      setManualId("");
      inputRef.current?.focus();
    }, 5000);
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualId.trim()) lookupMember(manualId.trim());
  }

  // ── Quick register functions ──────────────────────────────────────
  function openModal() {
    setQrResult(null);
    setQrError("");
    setForm((f) => ({ ...DEFAULT_FORM, staffName: f.staffName })); // keep staff selected
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setQrResult(null);
    setQrError("");
    inputRef.current?.focus();
  }

  async function handleQuickRegister() {
    if (!form.staffName) { setQrError("Please select the staff member on duty."); return; }
    if (!form.name.trim()) { setQrError("Parent / guardian name is required."); return; }

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

      // Auto-close after 6s
      setTimeout(() => closeModal(), 6000);
    } catch (err: unknown) {
      setQrError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setQrLoading(false);
    }
  }

  // ── Membership display helpers ────────────────────────────────────
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

  const selectedType = WALKIN_TYPES.find((m) => m.id === form.membershipType);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-gray-900 flex flex-col items-center justify-start pt-10 px-4">
      <h1 className="text-white font-fredoka text-4xl mb-1 text-center">QR Scanner</h1>
      <p className="text-gray-400 text-sm mb-3 text-center">Scan a member QR code or enter ID manually</p>

      {/* Gate policy banner */}
      <div className="w-full max-w-sm bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-4 py-2.5 mb-6 text-center">
        <p className="text-yellow-300 text-xs font-semibold">
          🚦 Every child entering must be registered — scan QR or use Quick Register below
        </p>
      </div>

      {/* Manual ID input */}
      <form onSubmit={handleManualSubmit} className="flex gap-2 mb-8 w-full max-w-sm">
        <input
          ref={inputRef}
          type="text"
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          placeholder="Member ID or scan QR"
          className="flex-1 bg-gray-800 text-white border border-gray-600 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-[#1a56db] placeholder-gray-500"
          autoComplete="off"
        />
        <button type="submit"
          className="bg-[#1a56db] text-white font-bold px-5 py-3 rounded-xl hover:bg-blue-600 transition-colors">
          Go
        </button>
      </form>

      {loading && <div className="text-gray-400 text-lg animate-pulse">Looking up...</div>}

      {error && (
        <div className="bg-red-900/50 text-red-300 rounded-2xl px-6 py-4 text-center max-w-sm w-full">
          {error}
        </div>
      )}

      {/* ── Checked in ── */}
      {checkedIn && member && (
        <div className="flex flex-col gap-3 max-w-sm w-full">
          <div className="bg-green-500 text-white rounded-2xl p-6 text-center">
            <div className="text-5xl mb-3">✓</div>
            <h2 className="font-fredoka text-3xl mb-1">{member.name}</h2>
            <p className="text-green-100 mb-3">Checked in successfully!</p>
            {isSessionBased && (
              <div className="bg-white/20 rounded-xl px-4 py-3 mb-3">
                {sessionsLeft !== null && sessionsLeft > 0 ? (
                  <p className="text-white font-bold">
                    {sessionsLeft} session{sessionsLeft !== 1 ? "s" : ""} remaining
                  </p>
                ) : sessionsLeft === 0 ? (
                  <p className="text-yellow-200 font-bold">⚠️ Last session used — remind to renew!</p>
                ) : null}
              </div>
            )}
            {member.email && (
              <div className="bg-white/10 rounded-xl px-3 py-2 text-xs text-green-100">
                🌟 Points earned! Remind {member.name.split(" ")[0]} to always scan their QR card to keep earning loyalty points.
              </div>
            )}
            {!member.email && (
              <div className="bg-white/10 rounded-xl px-3 py-2 text-xs text-yellow-200">
                💡 No email on file — ask them to register online to start earning loyalty points & get their QR card.
              </div>
            )}
          </div>

          {/* Add another session — for drop-in extras */}
          <button
            onClick={() => {
              setForm((f) => ({
                ...DEFAULT_FORM,
                staffName: f.staffName,
                name: member.name,
                kidsNames: member.kids_names ?? "",
                kidsCount: member.kids_count ?? 1,
                membershipType: member.membership_type in WALKIN_TYPES.reduce((a, m) => ({ ...a, [m.id]: true }), {} as Record<string,boolean>)
                  ? member.membership_type
                  : "session_group",
              }));
              setQrResult(null);
              setQrError("");
              setShowModal(true);
            }}
            className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-2xl py-3 text-sm font-semibold transition-colors"
          >
            + Register another session for {member.name.split(" ")[0]}
          </button>
        </div>
      )}

      {/* ── Member found, not yet checked in ── */}
      {member && !checkedIn && (
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
          {isMonthlyFlex && isExpired && (
            <div className="bg-red-100 text-red-700 rounded-xl px-3 py-2 mb-4 text-sm font-semibold text-center">
              ⛔ Monthly membership expired — renewal required
            </div>
          )}
          {isMonthlyFlex && isExpiringSoon && (
            <div className="bg-orange-100 text-orange-700 rounded-xl px-3 py-2 mb-4 text-sm text-center">
              ⚠️ Membership expires in <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong> — remind to renew!
            </div>
          )}
          {member.slip_status !== "approved" && (
            <div className="bg-yellow-100 text-yellow-800 rounded-xl px-3 py-2 mb-4 text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>Payment <strong>{member.slip_status.replace("_", " ")}</strong> — confirm with member before checking in</span>
            </div>
          )}
          <h2 className="font-fredoka text-2xl text-gray-900 mb-1">{member.name}</h2>
          <p className="text-gray-500 text-sm mb-1">{membershipLabel}</p>
          {member.kids_names && (
            <p className="text-xs text-gray-400 mb-1">👶 Kids: {member.kids_names}</p>
          )}
          {member.email && (
            <p className="text-xs text-gray-400 mb-1">✉ {member.email}</p>
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
                <p className="text-xs text-orange-500 font-medium">Almost out — suggest renewal!</p>
              )}
            </div>
          )}
          {isMonthlyFlex && expiryDate && !isExpired && (
            <div className="bg-blue-50 rounded-xl px-3 py-2 my-3 text-center">
              <p className="text-xs text-gray-500">Membership Valid Until</p>
              <p className="font-fredoka text-xl text-[#1a56db]">
                {expiryDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          )}
          <button
            onClick={handleCheckIn}
            disabled={loading || (isMonthlyFlex && isExpired)}
            className="w-full bg-[#22c55e] text-white font-bold text-xl py-4 rounded-2xl hover:bg-green-500 transition-colors disabled:opacity-50 mt-3"
          >
            {loading ? "Checking in…" : "✓ Check In"}
          </button>
          <button
            onClick={() => { setMember(null); setManualId(""); inputRef.current?.focus(); }}
            className="w-full text-gray-400 text-sm mt-3 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Hint */}
      {!member && !loading && !error && (
        <div className="text-gray-600 text-center text-sm mt-8 max-w-xs space-y-2">
          <p>Connect a USB or Bluetooth QR scanner — it types the member ID directly into the input above.</p>
          <p className="text-gray-700 text-xs">Each scan earns loyalty points for the member.</p>
        </div>
      )}

      {/* ── Quick Register FAB ────────────────────────────────────── */}
      <button
        onClick={openModal}
        className="fixed bottom-6 right-6 bg-green-500 text-white font-bold px-5 py-3 rounded-2xl shadow-xl hover:bg-green-400 active:scale-95 transition-all text-sm flex items-center gap-2 z-40"
      >
        <span className="text-xl leading-none">+</span> Quick Register
      </button>

      {/* ── Quick Register Modal ──────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-3">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-700">
              <h2 className="text-white font-fredoka text-2xl">Quick Register</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-white text-2xl leading-none">✕</button>
            </div>

            {/* Success state */}
            {qrResult ? (
              <div className={`m-5 rounded-2xl p-6 text-center ${qrResult.checked_in ? "bg-green-500" : "bg-blue-600"} text-white`}>
                <div className="text-5xl mb-3">{qrResult.checked_in ? "✓" : "⏳"}</div>
                <h3 className="font-fredoka text-2xl mb-1">{qrResult.name}</h3>
                {qrResult.checked_in ? (
                  <>
                    <p className="text-green-100 mb-2">Registered & checked in!</p>
                    <p className="text-xs text-green-200">Cash recorded · Drawer logged</p>
                  </>
                ) : (
                  <>
                    <p className="text-blue-100 mb-2">Registered — payment pending</p>
                    <p className="text-xs text-blue-200">Ask them to transfer via PromptPay and show the slip. Staff will approve in Payments.</p>
                  </>
                )}
                <p className="text-xs opacity-60 mt-3">Closing in a moment…</p>
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
                    <option value="">— Select staff —</option>
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
                    Kids names
                  </label>
                  <input
                    type="text"
                    value={form.kidsNames}
                    onChange={(e) => setForm((f) => ({ ...f, kidsNames: e.target.value }))}
                    placeholder="e.g. Leo, Mia"
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1a56db] placeholder-gray-500"
                  />
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
                    >−</button>
                    <span className="text-white font-fredoka text-2xl w-8 text-center">{form.kidsCount}</span>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, kidsCount: f.kidsCount + 1 }))}
                      className="w-11 h-11 bg-gray-700 text-white rounded-xl text-xl font-bold hover:bg-gray-600 transition-colors"
                    >+</button>
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
                    className={`flex-2 flex-1 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 ${
                      form.paymentMethod === "cash"
                        ? "bg-green-500 hover:bg-green-400 text-white"
                        : "bg-blue-600 hover:bg-blue-500 text-white"
                    }`}
                  >
                    {qrLoading
                      ? "Registering…"
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

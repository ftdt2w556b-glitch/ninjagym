"use client";

import { useState } from "react";

type Staff = { id: string; name: string; staffType: "profile" | "pos"; hasPin: boolean };
type Screen = "staff" | "pin" | "sale" | "confirm" | "result";
type SaleType = "walkin" | "membership";

const MEMBERSHIP_OPTIONS = [
  { label: "Group Session (1 kid)", amount: 350, saleType: "walkin" as SaleType },
  { label: "5-Session Pack", amount: 1500, saleType: "membership" as SaleType },
  { label: "10-Session Pack", amount: 2600, saleType: "membership" as SaleType },
  { label: "Monthly Flex", amount: 3500, saleType: "membership" as SaleType },
];

export default function PosSimple({
  staff,
  priceMap,
}: {
  staff: Staff[];
  priceMap: Record<string, number>;
}) {
  const [screen, setScreen] = useState<Screen>("staff");
  const [activeStaff, setActiveStaff] = useState<Staff | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const [selectedOption, setSelectedOption] = useState(0);
  const [kids, setKids] = useState(1);
  const [memberPin, setMemberPin] = useState("");
  const [linkedMember, setLinkedMember] = useState<{ id: number; name: string } | null>(null);
  const [pinLookupError, setPinLookupError] = useState("");

  const [processing, setProcessing] = useState(false);
  const [saleResult, setSaleResult] = useState<{ ok: boolean; message: string } | null>(null);

  const option = MEMBERSHIP_OPTIONS[selectedOption];
  const isWalkin = option.saleType === "walkin";
  const total = isWalkin ? option.amount * kids : option.amount;

  // ── PIN pad entry ──────────────────────────────────────────────────────────
  function handlePinDigit(d: string) {
    if (pinInput.length >= 4) return;
    const next = pinInput + d;
    setPinInput(next);
    if (next.length === 4) verifyPin(next);
  }

  function handlePinDelete() {
    setPinInput((p) => p.slice(0, -1));
    setPinError("");
  }

  async function verifyPin(pin: string) {
    if (!activeStaff) return;
    try {
      const res = await fetch("/api/pos/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: activeStaff.id, staffType: activeStaff.staffType, pin }),
      });
      if (res.ok) {
        setPinInput("");
        setPinError("");
        setScreen("sale");
      } else {
        setPinInput("");
        setPinError("Wrong PIN. Try again.");
      }
    } catch {
      setPinInput("");
      setPinError("Connection error. Try again.");
    }
  }

  // ── Member PIN lookup ──────────────────────────────────────────────────────
  async function lookupMemberPin(pin: string) {
    if (pin.length !== 4) return;
    try {
      const res = await fetch(`/api/scanner/lookup?pin=${pin}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.id) {
          setLinkedMember({ id: data.id, name: data.name });
          setPinLookupError("");
          return;
        }
      }
      setPinLookupError("PIN not found");
    } catch {
      setPinLookupError("Connection error");
    }
  }

  function handleMemberPinChange(val: string) {
    const clean = val.replace(/\D/g, "").slice(0, 4);
    setMemberPin(clean);
    setLinkedMember(null);
    setPinLookupError("");
    if (clean.length === 4) lookupMemberPin(clean);
  }

  // ── Process sale ───────────────────────────────────────────────────────────
  async function processSale() {
    if (!activeStaff) return;
    setProcessing(true);
    setSaleResult(null);

    try {
      const res = await fetch("/api/pos/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cash_sale",
          staffId: activeStaff.id,
          staffType: activeStaff.staffType,
          staffName: activeStaff.name,
          amount: total,
          saleType: option.saleType,
          items: [{ name: option.label, qty: isWalkin ? kids : 1, price: option.amount }],
          notes: linkedMember ? `Member PIN: ${memberPin} (${linkedMember.name})` : null,
        }),
      });

      if (!res.ok) throw new Error("Sale failed");

      // If linked member, create top-up registration
      if (linkedMember) {
        try {
          const body = new FormData();
          body.append("name", linkedMember.name);
          body.append("membership_type", option.saleType === "walkin" ? "single" : "bulk_5");
          body.append("kids_count", String(kids));
          body.append("payment_method", "cash");
          body.append("amount_paid", String(total));
          body.append("parent_member_id", String(linkedMember.id));
          body.append("notes", `POS sale by ${activeStaff.name}`);
          const regRes = await fetch("/api/members", { method: "POST", body });
          if (regRes.ok) {
            const regData = await regRes.json();
            const approveBody = new FormData();
            approveBody.append("id", String(regData.id));
            approveBody.append("action", "approve");
            approveBody.append("type", "member");
            await fetch("/api/payments", { method: "POST", body: approveBody });
          }
        } catch {
          // non-fatal
        }
      }

      setSaleResult({ ok: true, message: `Sale complete — ${total.toLocaleString()} THB collected` });
      // Reset sale fields
      setKids(1);
      setMemberPin("");
      setLinkedMember(null);
      setPinLookupError("");
      setSelectedOption(0);
      setScreen("result");
    } catch {
      setSaleResult({ ok: false, message: "Sale failed. Check connection and try again." });
      setScreen("result");
    } finally {
      setProcessing(false);
    }
  }

  function resetToSale() {
    setSaleResult(null);
    setScreen("sale");
  }

  function switchStaff() {
    setActiveStaff(null);
    setPinInput("");
    setPinError("");
    setScreen("staff");
    setKids(1);
    setMemberPin("");
    setLinkedMember(null);
    setSaleResult(null);
  }

  // ── Styles (inline for Android 9 compat) ──────────────────────────────────
  const s = {
    page:       { minHeight: "100vh", backgroundColor: "#111827", color: "#ffffff", fontFamily: "sans-serif" },
    header:     { backgroundColor: "#1f2937", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" },
    headerTitle:{ fontSize: "20px", fontWeight: "bold", color: "#ffffff" },
    headerSub:  { fontSize: "14px", color: "#9ca3af" },
    body:       { padding: "16px", maxWidth: "480px", margin: "0 auto" },
    card:       { backgroundColor: "#1f2937", borderRadius: "12px", padding: "20px", marginBottom: "16px" },
    h2:         { fontSize: "18px", fontWeight: "bold", marginBottom: "16px", color: "#ffffff" },
    label:      { fontSize: "14px", color: "#9ca3af", marginBottom: "6px", display: "block" },
    btn:        { display: "block", width: "100%", padding: "18px", borderRadius: "12px", border: "none", fontSize: "18px", fontWeight: "bold", cursor: "pointer", marginBottom: "10px", textAlign: "center" as const },
    btnBlue:    { backgroundColor: "#1a56db", color: "#ffffff" },
    btnGreen:   { backgroundColor: "#16a34a", color: "#ffffff" },
    btnGray:    { backgroundColor: "#374151", color: "#ffffff" },
    btnRed:     { backgroundColor: "#dc2626", color: "#ffffff" },
    staffBtn:   { display: "block", width: "100%", padding: "20px", borderRadius: "12px", border: "none", fontSize: "20px", fontWeight: "bold", cursor: "pointer", marginBottom: "12px", backgroundColor: "#374151", color: "#ffffff", textAlign: "center" as const },
    pinDisplay: { backgroundColor: "#111827", borderRadius: "12px", padding: "20px", textAlign: "center" as const, fontSize: "36px", letterSpacing: "12px", marginBottom: "20px", minHeight: "70px" },
    pinGrid:    { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "10px" },
    pinBtn:     { padding: "20px 0", borderRadius: "12px", border: "none", fontSize: "24px", fontWeight: "bold", cursor: "pointer", backgroundColor: "#374151", color: "#ffffff" },
    select:     { width: "100%", backgroundColor: "#111827", color: "#ffffff", border: "1px solid #4b5563", borderRadius: "10px", padding: "14px", fontSize: "16px", marginBottom: "16px" },
    input:      { width: "100%", backgroundColor: "#111827", color: "#ffffff", border: "1px solid #4b5563", borderRadius: "10px", padding: "14px", fontSize: "20px", textAlign: "center" as const, boxSizing: "border-box" as const },
    error:      { color: "#f87171", fontSize: "14px", marginBottom: "10px", textAlign: "center" as const },
    success:    { color: "#4ade80", fontSize: "14px", marginBottom: "10px", textAlign: "center" as const },
    total:      { backgroundColor: "#ffe033", color: "#111827", borderRadius: "12px", padding: "20px", textAlign: "center" as const, fontSize: "28px", fontWeight: "bold", marginBottom: "16px" },
    rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" },
    numRow:     { display: "flex", alignItems: "center", gap: "12px" },
    numBtn:     { width: "48px", height: "48px", borderRadius: "10px", border: "none", fontSize: "24px", fontWeight: "bold", cursor: "pointer", backgroundColor: "#374151", color: "#ffffff" },
  };

  // ── Staff selection ────────────────────────────────────────────────────────
  if (screen === "staff") {
    return (
      <div style={s.page}>
        <div style={s.header}>
          <span style={s.headerTitle}>NinjaGym POS</span>
          <span style={s.headerSub}>Select staff</span>
        </div>
        <div style={s.body}>
          {staff.map((st) => (
            <button key={st.id} style={s.staffBtn} onClick={() => { setActiveStaff(st); setScreen(st.hasPin ? "pin" : "sale"); }}>
              {st.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── PIN entry ──────────────────────────────────────────────────────────────
  if (screen === "pin") {
    const DIGITS = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
    return (
      <div style={s.page}>
        <div style={s.header}>
          <span style={s.headerTitle}>{activeStaff?.name}</span>
          <button onClick={switchStaff} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "16px", cursor: "pointer" }}>
            Back
          </button>
        </div>
        <div style={s.body}>
          <div style={s.card}>
            <p style={{ ...s.label, textAlign: "center", marginBottom: "12px" }}>Enter your PIN</p>
            <div style={s.pinDisplay}>{"●".repeat(pinInput.length)}</div>
            {pinError && <p style={s.error}>{pinError}</p>}
            <div style={s.pinGrid}>
              {DIGITS.map((d, i) => (
                <button
                  key={i}
                  style={{ ...s.pinBtn, opacity: d === "" ? 0 : 1, pointerEvents: d === "" ? "none" : "auto" }}
                  onClick={() => d === "⌫" ? handlePinDelete() : d && handlePinDigit(d)}
                  disabled={d === ""}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Sale screen ────────────────────────────────────────────────────────────
  if (screen === "sale") {
    return (
      <div style={s.page}>
        <div style={s.header}>
          <div>
            <span style={s.headerTitle}>NinjaGym POS</span>
            <span style={{ ...s.headerSub, marginLeft: "10px" }}>{activeStaff?.name}</span>
          </div>
          <button onClick={switchStaff} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "16px", cursor: "pointer" }}>
            Switch Staff
          </button>
        </div>
        <div style={s.body}>
          <div style={s.card}>
            <p style={s.label}>Product</p>
            <select style={s.select} value={selectedOption} onChange={(e) => { setSelectedOption(Number(e.target.value)); setKids(1); }}>
              {MEMBERSHIP_OPTIONS.map((o, i) => (
                <option key={i} value={i}>{o.label} — {o.amount.toLocaleString()} THB{i === 0 ? "/kid" : ""}</option>
              ))}
            </select>

            {isWalkin && (
              <div style={s.rowBetween}>
                <span style={s.label}>Number of kids</span>
                <div style={s.numRow}>
                  <button style={s.numBtn} onClick={() => setKids((k) => Math.max(1, k - 1))}>-</button>
                  <span style={{ fontSize: "22px", fontWeight: "bold", minWidth: "30px", textAlign: "center" }}>{kids}</span>
                  <button style={s.numBtn} onClick={() => setKids((k) => k + 1)}>+</button>
                </div>
              </div>
            )}

            <p style={s.label}>Member PIN (optional)</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={memberPin}
              onChange={(e) => handleMemberPinChange(e.target.value)}
              placeholder="0000"
              style={{ ...s.input, marginBottom: "8px" }}
            />
            {linkedMember && <p style={s.success}>Linked to {linkedMember.name}</p>}
            {pinLookupError && <p style={s.error}>{pinLookupError}</p>}
          </div>

          <div style={s.total}>{total.toLocaleString()} THB</div>

          <button
            style={{ ...s.btn, ...s.btnGreen }}
            onClick={() => setScreen("confirm")}
            disabled={processing}
          >
            Collect Cash
          </button>
          <button style={{ ...s.btn, ...s.btnGray }} onClick={switchStaff}>
            Switch Staff
          </button>
        </div>
      </div>
    );
  }

  // ── Confirm screen ─────────────────────────────────────────────────────────
  if (screen === "confirm") {
    return (
      <div style={s.page}>
        <div style={s.header}>
          <span style={s.headerTitle}>Confirm Sale</span>
          <span style={s.headerSub}>{activeStaff?.name}</span>
        </div>
        <div style={s.body}>
          <div style={s.card}>
            <p style={{ fontSize: "16px", color: "#d1d5db", marginBottom: "8px" }}>{option.label}</p>
            {isWalkin && <p style={{ fontSize: "14px", color: "#9ca3af", marginBottom: "8px" }}>{kids} kid{kids !== 1 ? "s" : ""}</p>}
            {linkedMember && <p style={{ fontSize: "14px", color: "#4ade80", marginBottom: "8px" }}>Member: {linkedMember.name}</p>}
          </div>
          <div style={s.total}>{total.toLocaleString()} THB</div>
          <button
            style={{ ...s.btn, ...s.btnGreen }}
            onClick={processSale}
            disabled={processing}
          >
            {processing ? "Processing..." : "Confirm — Cash Received"}
          </button>
          <button style={{ ...s.btn, ...s.btnGray }} onClick={() => setScreen("sale")} disabled={processing}>
            Back
          </button>
        </div>
      </div>
    );
  }

  // ── Result screen ──────────────────────────────────────────────────────────
  if (screen === "result") {
    const ok = saleResult?.ok ?? false;
    return (
      <div style={s.page}>
        <div style={{ ...s.body, paddingTop: "60px", textAlign: "center" }}>
          <div style={{ fontSize: "64px", marginBottom: "20px" }}>{ok ? "✅" : "❌"}</div>
          <p style={{ fontSize: "20px", fontWeight: "bold", color: ok ? "#4ade80" : "#f87171", marginBottom: "32px" }}>
            {saleResult?.message}
          </p>
          <button style={{ ...s.btn, ...(ok ? s.btnBlue : s.btnRed) }} onClick={ok ? resetToSale : resetToSale}>
            {ok ? "New Sale" : "Try Again"}
          </button>
          <button style={{ ...s.btn, ...s.btnGray }} onClick={switchStaff}>
            Switch Staff
          </button>
        </div>
      </div>
    );
  }

  return null;
}

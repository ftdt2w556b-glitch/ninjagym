"use client";

import { useState } from "react";
import { openDrawerAndPrint, openDrawerOnly } from "@/lib/pos/bridge";
import { MEMBERSHIP_TYPES, formatTHB } from "@/lib/pricing";
import { SHOP_CATALOG } from "@/lib/shop";

type StaffMember = { id: string; name: string; role: string; hasPin: boolean };

type Screen =
  | "select_staff"
  | "pin_entry"
  | "main"
  | "cash_sale"
  | "quick_member"
  | "quick_shop";

interface CartLine {
  label: string;
  qty: number;
  unit: number;
}

export default function PosScreen({ staff }: { staff: StaffMember[] }) {
  const [screen, setScreen] = useState<Screen>("select_staff");
  const [activeStaff, setActiveStaff] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  // Cash sale state
  const [saleType, setSaleType] = useState<"membership" | "shop" | "walkin">("walkin");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customAmount, setCustomAmount] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [membershipType, setMembershipType] = useState("session_group");
  const [kidsCount, setKidsCount] = useState(1);
  const [shopItemId, setShopItemId] = useState("tshirt_kids");
  const [shopOption, setShopOption] = useState("S");
  const [notes, setNotes] = useState("");

  // Feedback state
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; saleId?: number; printerOk?: boolean } | null>(null);
  const [drawerMsg, setDrawerMsg] = useState("");

  // ── Staff selection ──────────────────────────────────────────────
  function selectStaff(s: StaffMember) {
    setActiveStaff(s);
    setPinError("");
    setPin("");
    if (s.hasPin) {
      setScreen("pin_entry");
    } else {
      setScreen("main");
    }
  }

  function handlePinDigit(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      verifyPin(next);
    }
  }

  async function verifyPin(entered: string) {
    // Server-side check via API — just check against hashed pin
    const res = await fetch("/api/pos/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId: activeStaff!.id, pin: entered }),
    });
    if (res.ok) {
      setScreen("main");
      setPinError("");
    } else {
      setPinError("Incorrect PIN");
      setPin("");
    }
  }

  // ── Cart helpers ─────────────────────────────────────────────────
  function addMembershipToCart() {
    const mt = MEMBERSHIP_TYPES.find((m) => m.id === membershipType)!;
    const price = mt.perKid
      ? (BASE_PRICES[`price_${membershipType}`] ?? 0) * kidsCount
      : (BASE_PRICES[`price_${membershipType}`] ?? 0);
    setCart((prev) => [...prev, { label: `${mt.label}${mt.perKid ? ` x${kidsCount}` : ""}`, qty: 1, unit: price }]);
  }

  function addShopToCart() {
    const item = SHOP_CATALOG.find((i) => i.id === shopItemId)!;
    setCart((prev) => [...prev, { label: `${item.name} (${shopOption})`, qty: 1, unit: item.price }]);
  }

  function addCustomToCart() {
    const amt = Number(customAmount);
    if (!amt || !customLabel) return;
    setCart((prev) => [...prev, { label: customLabel, qty: 1, unit: amt }]);
    setCustomLabel("");
    setCustomAmount("");
  }

  function removeCartLine(i: number) {
    setCart((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = cart.reduce((s, l) => s + l.unit * l.qty, 0);

  // ── Process sale ─────────────────────────────────────────────────
  async function processSale() {
    if (total <= 0) return;
    setProcessing(true);
    setResult(null);

    // 1. Save to Supabase
    const res = await fetch("/api/pos/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "cash_sale",
        staffId: activeStaff!.id,
        amount: total,
        saleType,
        items: cart.map((l) => ({ name: l.label, qty: l.qty, price: l.unit })),
        notes: notes || null,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setProcessing(false);
      setResult({ success: false });
      return;
    }

    const saleId: number = data.saleId;

    // 2. Call printer bridge (non-blocking)
    const printerOk = await openDrawerAndPrint({
      saleId,
      items: cart.map((l) => ({ name: l.label, qty: l.qty, price: l.unit })),
      total,
      employee: activeStaff!.name,
    });

    setProcessing(false);
    setResult({ success: true, saleId, printerOk });
    setCart([]);
    setNotes("");
  }

  async function manualOpenDrawer() {
    setDrawerMsg("Opening drawer...");
    await fetch("/api/pos/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "open_drawer", staffId: activeStaff!.id, reason: "manual_open" }),
    });
    const bridgeOk = await openDrawerOnly(activeStaff!.name);
    setDrawerMsg(bridgeOk ? "Drawer opened." : "Drawer command sent — open manually if needed.");
    setTimeout(() => setDrawerMsg(""), 3000);
  }

  function resetSale() {
    setResult(null);
    setCart([]);
    setNotes("");
  }

  // ── Screens ──────────────────────────────────────────────────────

  if (screen === "select_staff") {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
        <h1 className="font-fredoka text-4xl text-white mb-2">NinjaGym POS</h1>
        <p className="text-gray-400 mb-8">Who are you?</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {staff.map((s) => (
            <button
              key={s.id}
              onClick={() => selectStaff(s)}
              className="bg-[#1a56db] text-white font-bold text-xl py-5 rounded-2xl hover:bg-blue-600 transition-colors shadow-lg"
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (screen === "pin_entry") {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
        <h1 className="font-fredoka text-3xl text-white mb-1">Enter PIN</h1>
        <p className="text-gray-400 mb-6">{activeStaff?.name}</p>
        <div className="flex gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`w-5 h-5 rounded-full ${pin.length > i ? "bg-[#ffe033]" : "bg-gray-600"}`} />
          ))}
        </div>
        {pinError && <p className="text-red-400 text-sm mb-4">{pinError}</p>}
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <button key={d} onClick={() => handlePinDigit(String(d))}
              className="bg-gray-700 text-white font-bold text-2xl py-5 rounded-2xl hover:bg-gray-600 transition-colors">
              {d}
            </button>
          ))}
          <div />
          <button onClick={() => handlePinDigit("0")}
            className="bg-gray-700 text-white font-bold text-2xl py-5 rounded-2xl hover:bg-gray-600 transition-colors">
            0
          </button>
          <button onClick={() => setPin((p) => p.slice(0, -1))}
            className="bg-gray-700 text-white font-bold text-lg py-5 rounded-2xl hover:bg-gray-600 transition-colors">
            ⌫
          </button>
        </div>
        <button onClick={() => setScreen("select_staff")} className="text-gray-500 text-sm hover:text-gray-400">
          Back
        </button>
      </div>
    );
  }

  // ── Main POS screen ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gray-900 px-4 py-3 flex items-center justify-between">
        <div>
          <span className="font-fredoka text-white text-xl">NinjaGym POS</span>
          <span className="text-gray-400 text-sm ml-3">{activeStaff?.name}</span>
        </div>
        <div className="flex gap-3 items-center">
          {drawerMsg && (
            <span className="text-yellow-400 text-xs">{drawerMsg}</span>
          )}
          <button onClick={manualOpenDrawer}
            className="bg-yellow-500 text-gray-900 font-bold text-sm px-4 py-2 rounded-xl hover:bg-yellow-400 transition-colors">
            Open Drawer
          </button>
          <button onClick={() => setScreen("select_staff")}
            className="text-gray-400 text-sm hover:text-white transition-colors">
            Switch Staff
          </button>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-4 py-6 grid grid-cols-1 gap-6 md:grid-cols-2">

        {/* Left: Sale builder */}
        <div className="flex flex-col gap-4">

          {/* Sale type tabs */}
          <div className="bg-white rounded-2xl shadow p-1 flex gap-1">
            {(["walkin", "membership", "shop"] as const).map((t) => (
              <button key={t} onClick={() => setSaleType(t)}
                className={`flex-1 py-2.5 rounded-xl font-semibold text-sm capitalize transition-colors ${
                  saleType === t ? "bg-[#1a56db] text-white" : "text-gray-500 hover:bg-gray-100"
                }`}>
                {t === "walkin" ? "Walk-in" : t === "membership" ? "Membership" : "Shop"}
              </button>
            ))}
          </div>

          {/* Membership selector */}
          {saleType === "membership" && (
            <div className="bg-white rounded-2xl shadow p-4 flex flex-col gap-3">
              <h3 className="font-bold text-gray-800">Membership</h3>
              <select value={membershipType} onChange={(e) => setMembershipType(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]">
                {MEMBERSHIP_TYPES.map((m) => (
                  <option key={m.id} value={m.id}>{m.label} — {formatTHB(BASE_PRICES[`price_${m.id}`] ?? 0)}</option>
                ))}
              </select>
              {MEMBERSHIP_TYPES.find((m) => m.id === membershipType)?.perKid && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Kids</label>
                  <select value={kidsCount} onChange={(e) => setKidsCount(Number(e.target.value))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]">
                    {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              )}
              <button onClick={addMembershipToCart}
                className="bg-[#1a56db] text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors">
                Add to Sale
              </button>
            </div>
          )}

          {/* Shop selector */}
          {saleType === "shop" && (
            <div className="bg-white rounded-2xl shadow p-4 flex flex-col gap-3">
              <h3 className="font-bold text-gray-800">Shop Item</h3>
              <select value={shopItemId} onChange={(e) => {
                setShopItemId(e.target.value);
                const item = SHOP_CATALOG.find((i) => i.id === e.target.value);
                setShopOption(item?.options.values[0] ?? "");
              }}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]">
                {SHOP_CATALOG.map((i) => (
                  <option key={i.id} value={i.id}>{i.name} — {formatTHB(i.price)}</option>
                ))}
              </select>
              <select value={shopOption} onChange={(e) => setShopOption(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]">
                {SHOP_CATALOG.find((i) => i.id === shopItemId)?.options.values.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <button onClick={addShopToCart}
                className="bg-[#1a56db] text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors">
                Add to Sale
              </button>
            </div>
          )}

          {/* Walk-in / custom amount */}
          {saleType === "walkin" && (
            <div className="bg-white rounded-2xl shadow p-4 flex flex-col gap-3">
              <h3 className="font-bold text-gray-800">Custom Amount</h3>
              <input type="text" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Description (e.g. Drop-in climb)"
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]" />
              <input type="number" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Amount (THB)"
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]" />
              <button onClick={addCustomToCart}
                className="bg-[#1a56db] text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors">
                Add to Sale
              </button>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white rounded-2xl shadow p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notes (optional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Member name, special note"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]" />
          </div>
        </div>

        {/* Right: Cart + checkout */}
        <div className="flex flex-col gap-4">

          {/* Result banner */}
          {result && (
            <div className={`rounded-2xl p-5 ${result.success ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
              {result.success ? (
                <>
                  <p className="font-bold text-lg">Sale #{result.saleId} recorded</p>
                  {result.printerOk ? (
                    <p className="text-green-100 text-sm">Receipt printed, drawer opened.</p>
                  ) : (
                    <p className="text-yellow-200 text-sm font-semibold">Printer offline — open drawer manually.</p>
                  )}
                  <button onClick={resetSale} className="mt-3 bg-white/20 text-white font-bold px-4 py-2 rounded-xl hover:bg-white/30 transition-colors">
                    New Sale
                  </button>
                </>
              ) : (
                <>
                  <p className="font-bold">Sale failed — check connection</p>
                  <button onClick={resetSale} className="mt-2 bg-white/20 text-white font-bold px-4 py-2 rounded-xl">Try Again</button>
                </>
              )}
            </div>
          )}

          {/* Cart */}
          <div className="bg-white rounded-2xl shadow p-5 flex-1">
            <h3 className="font-bold text-gray-800 mb-3">Current Sale</h3>
            {cart.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">Add items to begin</p>
            ) : (
              <div className="flex flex-col gap-2 mb-4">
                {cart.map((line, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-800">{line.label}</span>
                      {line.qty > 1 && <span className="text-gray-400 ml-1">x{line.qty}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900">{(line.unit * line.qty).toLocaleString()} THB</span>
                      <button onClick={() => removeCartLine(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <>
                <div className="border-t border-gray-100 pt-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-700 text-lg">TOTAL</span>
                    <span className="font-fredoka text-3xl text-[#1a56db]">{total.toLocaleString()} THB</span>
                  </div>
                </div>

                <button
                  onClick={processSale}
                  disabled={processing}
                  className="w-full bg-[#22c55e] text-white font-bold text-xl py-5 rounded-2xl hover:bg-green-500 transition-colors disabled:opacity-50 shadow-lg"
                >
                  {processing ? "Processing..." : "Collect Cash + Print"}
                </button>
                <button onClick={() => setCart([])}
                  className="w-full text-gray-400 text-sm mt-2 hover:text-gray-600 transition-colors">
                  Clear Sale
                </button>
              </>
            )}
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-3">
            <a href="/admin/members"
              className="bg-white rounded-2xl shadow p-4 text-center font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Members
            </a>
            <a href="/scanner"
              className="bg-[#1a56db] rounded-2xl shadow p-4 text-center font-semibold text-white hover:bg-blue-700 transition-colors">
              QR Scanner
            </a>
            <a href="/admin/payments"
              className="bg-white rounded-2xl shadow p-4 text-center font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Payments
            </a>
            <a href="/admin/dashboard"
              className="bg-white rounded-2xl shadow p-4 text-center font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// Static price map for client-side calculation
const BASE_PRICES: Record<string, number> = {
  price_climb_unguided: 250,
  price_session_group: 350,
  price_session_1to1: 600,
  price_day_camp: 450,
  price_combo_game_train: 400,
  price_all_day: 500,
  price_monthly_2hr: 2500,
  price_monthly_5hr: 5500,
  price_sessions_4: 1200,
  price_sessions_8: 2200,
  price_sessions_16: 4000,
  price_sessions_20: 4800,
  price_day_camp_4: 1600,
  price_day_camp_8: 3000,
  price_day_camp_16: 5600,
  price_day_camp_20: 6800,
  price_sessions_1to1_4: 2200,
  price_sessions_1to1_8: 4200,
  price_sessions_1to1_16: 8000,
  price_sessions_1to1_20: 9600,
  price_all_day_4: 1800,
  price_all_day_8: 3400,
  price_all_day_16: 6400,
  price_all_day_20: 7800,
  price_combo_4: 1400,
  price_combo_8: 2600,
  price_combo_16: 4800,
  price_combo_20: 5800,
};

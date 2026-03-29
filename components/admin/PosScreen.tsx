"use client";

import { useState, useEffect } from "react";
import { openDrawerAndPrint, openDrawerOnly } from "@/lib/pos/bridge";
import { MEMBERSHIP_TYPES, BASE_PRICES, calcBulkPrice, formatTHB } from "@/lib/pricing";
import { SHOP_CATALOG, GIFT_CARD_PRICES } from "@/lib/shop";

type StaffMember = { id: string; name: string; role: string; hasPin: boolean; staffType: "profile" | "pos" };
type InventoryRow = { item_id: string; variant: string; stock_qty: number };

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
  item_id?: string;  // for inventory tracking
  variant?: string;  // for inventory tracking
}

// Shop price key map: catalog id → settings key
const SHOP_PRICE_KEY: Record<string, string> = {
  tshirt_kids:  "price_shop_tshirt_kids",
  tshirt_adult: "price_shop_tshirt_adult",
  shake_bake:   "price_shop_shake_bake",
};

export default function PosScreen({ staff, inventory = [] }: { staff: StaffMember[]; inventory?: InventoryRow[] }) {
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
  const [bulkQty, setBulkQty] = useState(4);
  const [kidsCount, setKidsCount] = useState(1);
  const [shopItemId, setShopItemId] = useState("tshirt_kids");
  const [shopOption, setShopOption] = useState("S");
  const [notes, setNotes] = useState("");

  // Live prices from admin settings (falls back to lib/pricing hardcoded values)
  const [settingsPrices, setSettingsPrices] = useState<Record<string, number>>({
    ...BASE_PRICES,
    price_shop_tshirt_kids: 300,
    price_shop_tshirt_adult: 300,
    price_shop_shake_bake: 200,
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: Record<string, string | number>) => {
        setSettingsPrices((prev) => {
          const updated = { ...prev };
          for (const [k, v] of Object.entries(data)) {
            if (!k.startsWith("desc_")) {
              const n = parseFloat(String(v));
              if (!isNaN(n)) updated[k] = n;
            }
          }
          return updated;
        });
      })
      .catch(() => {}); // silently fall back to defaults
  }, []);

  // Helpers
  function getShopPrice(catalogId: string, option: string): number {
    if (catalogId === "gift_card") return GIFT_CARD_PRICES[option] ?? 0;
    const key = SHOP_PRICE_KEY[catalogId];
    return key ? (settingsPrices[key] ?? 0) : (SHOP_CATALOG.find((i) => i.id === catalogId)?.price ?? 0);
  }

  function getStock(itemId: string, variant: string): number | null {
    const row = inventory.find((r) => r.item_id === itemId && r.variant === variant);
    return row ? row.stock_qty : null;
  }

  function stockBadge(qty: number | null): React.ReactNode {
    if (qty === null) return null;
    if (qty === 0) return <span className="text-xs font-bold text-red-500 ml-1">OUT OF STOCK</span>;
    if (qty <= 3) return <span className="text-xs font-bold text-orange-500 ml-1">Only {qty} left</span>;
    return <span className="text-xs text-gray-400 ml-1">{qty} in stock</span>;
  }

  // Feedback state
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; saleId?: number; printerOk?: boolean } | null>(null);
  const [drawerMsg, setDrawerMsg] = useState("");

  // ── Staff selection ──────────────────────────────────────────────
  function selectStaff(s: StaffMember) {
    setActiveStaff(s);
    setPinError("");
    setPin("");
    if (s.staffType === "pos" && !s.hasPin) {
      setPinError("No PIN set — contact admin");
      return;
    }
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
      body: JSON.stringify({ staffId: activeStaff!.id, pin: entered, staffType: activeStaff!.staffType }),
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
    if (mt.bulk && mt.bulkBase) {
      const basePrice = settingsPrices[mt.bulkBase] ?? 0;
      const total = calcBulkPrice(basePrice, bulkQty);
      const discountPct = Math.min(bulkQty, 20);
      setCart((prev) => [...prev, {
        label: `${mt.label} ×${bulkQty} (${discountPct}% off)`,
        qty: 1,
        unit: total,
      }]);
    } else {
      const price = mt.perKid
        ? (settingsPrices[`price_${mt.id}`] ?? 0) * kidsCount
        : (settingsPrices[`price_${mt.id}`] ?? 0);
      setCart((prev) => [...prev, {
        label: `${mt.label}${mt.perKid ? ` ×${kidsCount}` : ""}`,
        qty: 1,
        unit: price,
      }]);
    }
  }

  function addShopToCart() {
    const item = SHOP_CATALOG.find((i) => i.id === shopItemId)!;
    const unit = getShopPrice(item.id, shopOption);
    const isPhysical = item.id !== "gift_card";
    setCart((prev) => [...prev, {
      label: `${item.name} (${shopOption})`,
      qty: 1,
      unit,
      item_id: isPhysical ? item.id : undefined,
      variant: isPhysical ? shopOption : undefined,
    }]);
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
        staffType: activeStaff!.staffType,
        staffName: activeStaff!.name,
        amount: total,
        saleType,
        items: cart.map((l) => ({ name: l.label, qty: l.qty, price: l.unit, item_id: l.item_id, variant: l.variant })),
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
      body: JSON.stringify({ action: "open_drawer", staffId: activeStaff!.id, staffType: activeStaff!.staffType, staffName: activeStaff!.name, reason: "manual_open" }),
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
        {pinError && <p className="text-red-400 text-sm mb-4">{pinError}</p>}
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
          {saleType === "membership" && (() => {
            const mt = MEMBERSHIP_TYPES.find((m) => m.id === membershipType)!;
            return (
              <div className="bg-white rounded-2xl shadow p-4 flex flex-col gap-3">
                <h3 className="font-bold text-gray-800">Membership</h3>
                <select value={membershipType} onChange={(e) => setMembershipType(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]">
                  {MEMBERSHIP_TYPES.map((m) => {
                    let priceLabel: string;
                    if (m.bulk && m.bulkBase) {
                      const base = settingsPrices[m.bulkBase] ?? 0;
                      priceLabel = `${formatTHB(base)}/session (bulk)`;
                    } else {
                      const price = settingsPrices[`price_${m.id}`] ?? 0;
                      priceLabel = `${formatTHB(price)}${m.perKid ? "/kid" : ""}`;
                    }
                    return <option key={m.id} value={m.id}>{m.label} — {priceLabel}</option>;
                  })}
                </select>

                {/* Per-kid quantity */}
                {mt?.perKid && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Number of Kids</label>
                    <select value={kidsCount} onChange={(e) => setKidsCount(Number(e.target.value))}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]">
                      {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                )}

                {/* Bulk quantity + live price */}
                {mt?.bulk && mt.bulkBase && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-gray-500 block">Number of Sessions</label>
                    <select value={bulkQty} onChange={(e) => setBulkQty(Number(e.target.value))}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]">
                      {[2,3,4,5,6,7,8,9,10,12,14,16,18,20].map((n) => {
                        const base = settingsPrices[mt.bulkBase!] ?? 0;
                        const total = calcBulkPrice(base, n);
                        return <option key={n} value={n}>{n} sessions — {formatTHB(total)} ({Math.min(n,20)}% off)</option>;
                      })}
                    </select>
                  </div>
                )}

                {/* Live price preview */}
                <div className="bg-gray-50 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800 flex justify-between">
                  <span>Total</span>
                  <span className="text-[#1a56db]">
                    {mt?.bulk && mt.bulkBase
                      ? formatTHB(calcBulkPrice(settingsPrices[mt.bulkBase] ?? 0, bulkQty))
                      : formatTHB((settingsPrices[`price_${mt?.id}`] ?? 0) * (mt?.perKid ? kidsCount : 1))
                    }
                  </span>
                </div>

                <button onClick={addMembershipToCart}
                  className="bg-[#1a56db] text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors">
                  Add to Sale
                </button>
              </div>
            );
          })()}

          {/* Shop selector */}
          {saleType === "shop" && (() => {
            const catalogItem = SHOP_CATALOG.find((i) => i.id === shopItemId);
            const isGiftCard = shopItemId === "gift_card";
            const livePrice = getShopPrice(shopItemId, shopOption);
            const currentStock = !isGiftCard ? getStock(shopItemId, shopOption) : null;
            return (
              <div className="bg-white rounded-2xl shadow p-4 flex flex-col gap-3">
                <h3 className="font-bold text-gray-800">Shop Item</h3>
                {/* Item selector */}
                <select value={shopItemId} onChange={(e) => {
                  setShopItemId(e.target.value);
                  const item = SHOP_CATALOG.find((i) => i.id === e.target.value);
                  const firstOpt = item?.options.groups?.[0]?.values[0] ?? item?.options.values?.[0] ?? "";
                  setShopOption(firstOpt);
                }}
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]">
                  {SHOP_CATALOG.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}{i.id === "gift_card" ? " — price by program" : ` — ${formatTHB(getShopPrice(i.id, shopItemId === i.id ? shopOption : (i.options.groups?.[0]?.values[0] ?? i.options.values?.[0] ?? "")))}`}
                    </option>
                  ))}
                </select>
                {/* Option/size/program select */}
                <select value={shopOption} onChange={(e) => setShopOption(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]">
                  {catalogItem?.options.groups
                    ? catalogItem.options.groups.map((g) => (
                        <optgroup key={g.label} label={g.label}>
                          {g.values.map((v) => {
                            const qty = getStock(shopItemId, v);
                            const stockNote = qty === 0 ? " — OUT OF STOCK" : qty !== null && qty <= 3 ? ` — only ${qty} left` : qty !== null ? ` — ${qty} in stock` : "";
                            return <option key={v} value={v}>{v}{stockNote}</option>;
                          })}
                        </optgroup>
                      ))
                    : (catalogItem?.options.values ?? []).map((v) => {
                        const qty = isGiftCard ? null : getStock(shopItemId, v);
                        const stockNote = qty === 0 ? " — OUT OF STOCK" : qty !== null && qty <= 3 ? ` — only ${qty} left` : qty !== null ? ` — ${qty} in stock` : "";
                        const priceNote = isGiftCard ? ` — ${formatTHB(GIFT_CARD_PRICES[v] ?? 0)}` : "";
                        return <option key={v} value={v}>{v}{priceNote}{stockNote}</option>;
                      })
                  }
                </select>
                {/* Stock badge for selected variant */}
                {!isGiftCard && (
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-gray-500">Stock:</span>
                    {stockBadge(currentStock)}
                    {currentStock === null && <span className="text-xs text-gray-400">not tracked</span>}
                  </div>
                )}
                {/* Live price preview */}
                <div className="bg-gray-50 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800 flex justify-between">
                  <span>Total</span>
                  <span className="text-[#1a56db]">{formatTHB(livePrice)}</span>
                </div>
                <button onClick={addShopToCart}
                  disabled={currentStock === 0}
                  className="bg-[#1a56db] text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {currentStock === 0 ? "Out of Stock" : "Add to Sale"}
                </button>
              </div>
            );
          })()}

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

// BASE_PRICES and calcBulkPrice imported from @/lib/pricing

"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { translations, Lang } from "@/lib/i18n/translations";
import { SHOP_CATALOG, GIFT_CARD_PRICES } from "@/lib/shop";
import { formatTHB } from "@/lib/pricing";

const StripePayment = lazy(() => import("@/components/public/StripePayment"));

// Map catalog item id → settings key (must match admin prices page keys)
const SHOP_PRICE_KEY: Record<string, string> = {
  tshirt_kids:  "price_shop_tshirt_kids",
  tshirt_adult: "price_shop_tshirt_adult",
  shake_bake:   "price_shop_shake_bake",
};

interface CartItem {
  catalogId: string;
  name: string;
  option: string;
  qty: number;
  unit_price: number;
}

function getFirstOption(item: (typeof SHOP_CATALOG)[0]): string {
  if (item.options.groups && item.options.groups.length > 0) {
    return item.options.groups[0].values[0];
  }
  return item.options.values?.[0] ?? "";
}

export default function ShopPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const t = translations[lang];
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", phone: "", email: "", payment_method: "cash" });
  const [slip, setSlip] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Stripe two-step state
  const [stripeStep, setStripeStep] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);

  // Dynamic prices from admin settings
  const [settingsPrices, setSettingsPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    const saved = localStorage.getItem("ng_lang") as Lang | null;
    if (saved) setLang(saved);
    const init: Record<string, string> = {};
    SHOP_CATALOG.forEach((item) => { init[item.id] = getFirstOption(item); });
    setSelections(init);
    // Fetch live prices from admin settings
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: Record<string, string | number>) => {
        const prices: Record<string, number> = {};
        for (const [k, v] of Object.entries(data)) {
          if (!k.startsWith("desc_")) {
            const n = parseFloat(String(v));
            if (!isNaN(n)) prices[k] = n;
          }
        }
        setSettingsPrices(prices);
      })
      .catch(() => {}); // silently fall back to catalog defaults
  }, []);

  function getItemPrice(catalogId: string, option: string): number {
    if (catalogId === "gift_card") return GIFT_CARD_PRICES[option] ?? 0;
    const key = SHOP_PRICE_KEY[catalogId];
    if (key && settingsPrices[key] !== undefined) return settingsPrices[key];
    const item = SHOP_CATALOG.find((i) => i.id === catalogId);
    return item?.price ?? 0;
  }

  function handleLang(l: Lang) { setLang(l); localStorage.setItem("ng_lang", l); }

  function addToCart(catalogId: string) {
    const item = SHOP_CATALOG.find((i) => i.id === catalogId)!;
    const option = selections[catalogId] ?? getFirstOption(item);
    const unit_price = getItemPrice(catalogId, option);
    setCart((prev) => {
      const existing = prev.find((c) => c.catalogId === catalogId && c.option === option);
      if (existing) {
        return prev.map((c) =>
          c.catalogId === catalogId && c.option === option ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [...prev, { catalogId, name: item.name, option, qty: 1, unit_price }];
    });
  }

  function removeFromCart(catalogId: string, option: string) {
    setCart((prev) => prev.filter((c) => !(c.catalogId === catalogId && c.option === option)));
  }

  const total = cart.reduce((sum, c) => sum + c.unit_price * c.qty, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0) { setError("Add at least one item to your order."); return; }
    setSubmitting(true);
    setError("");

    try {
      const body = new FormData();
      body.append("name", form.name);
      body.append("phone", form.phone);
      body.append("email", form.email);
      body.append("payment_method", form.payment_method);
      body.append("total_amount", String(total));
      body.append("items", JSON.stringify(
        cart.map((c) => ({ id: c.catalogId, name: c.name, qty: c.qty, size_or_flavor: c.option, unit_price: c.unit_price }))
      ));
      if (slip && form.payment_method === "promptpay") body.append("slip", slip);

      const res = await fetch("/api/shop-orders", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      if (form.payment_method === "stripe") {
        setPendingOrderId(data.id);
        setStripeStep(true);
        setSubmitting(false);
      } else {
        router.push("/shop/submitted");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  // Stripe payment screen
  if (stripeStep && pendingOrderId) {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setStripeStep(false)} className="text-white/70 hover:text-white text-2xl leading-none">←</button>
          <h1 className="font-fredoka text-3xl text-white drop-shadow">Card Payment</h1>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
            <span className="text-gray-600 text-sm">{cart.length} item{cart.length !== 1 ? "s" : ""}</span>
            <span className="font-fredoka text-2xl text-[#1a56db]">{formatTHB(total)}</span>
          </div>
          <Suspense fallback={<p className="text-gray-400 text-sm text-center py-4 animate-pulse">Loading...</p>}>
            <StripePayment
              amount={total}
              description="NinjaGym shop order"
              referenceId={pendingOrderId}
              referenceType="shop"
              onSuccess={() => router.push("/shop/submitted")}
              onError={(msg) => setError(msg)}
            />
          </Suspense>
          {error && <div className="bg-red-100 text-red-700 rounded-xl px-4 py-3 text-sm mt-3">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* CSS for float animation */}
      <style jsx global>{`
        @keyframes floatShop {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .float-shop { animation: floatShop 3s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white/70 hover:text-white text-sm">← Back</Link>
          <Image src="/images/logo_small.png" alt="NinjaGym" width={36} height={36} />
        </div>
        <LanguageSwitcher current={lang} onChange={handleLang} />
      </div>

      {/* Hero image */}
      <div className="rounded-2xl overflow-hidden shadow-xl mb-4 -mx-1">
        <Image
          src="/images/ninjagymshop_small.jpg"
          alt="NinjaGym Store"
          width={480}
          height={240}
          className="w-full object-cover"
          priority
        />
      </div>

      <h1 className="font-fredoka text-3xl text-white drop-shadow mb-1">{t.shopTitle}</h1>
      <p className="text-white/70 text-sm mb-5">{t.shopSubtitle}</p>

      {/* Catalog */}
      <div className="flex flex-col gap-4 mb-6">
        {SHOP_CATALOG.map((item) => {
          const hasGroups = item.options.groups && item.options.groups.length > 0;
          const currentOption = selections[item.id] ?? getFirstOption(item);
          const displayPrice = getItemPrice(item.id, currentOption);

          return (
            <div key={item.id} className="bg-white rounded-2xl p-4 shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 pr-2">
                  <h2 className="font-bold text-gray-800">{item.name}</h2>
                  {item.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                  )}
                </div>
                <span className="font-fredoka text-lg text-[#1a56db] shrink-0">
                  {formatTHB(displayPrice)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">{item.options.label}</label>
                  <select
                    value={currentOption}
                    onChange={(e) => setSelections({ ...selections, [item.id]: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
                  >
                    {hasGroups
                      ? item.options.groups!.map((group) => (
                          <optgroup key={group.label} label={group.label}>
                            {group.values.map((v) => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </optgroup>
                        ))
                      : item.options.values!.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))
                    }
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => addToCart(item.id)}
                  className="bg-[#1a56db] text-white font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors mt-4"
                >
                  {t.addToCart}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart */}
      {cart.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow mb-4">
          <h2 className="font-bold text-gray-800 mb-3">{t.cart}</h2>
          <div className="flex flex-col gap-2">
            {cart.map((item) => (
              <div key={`${item.catalogId}__${item.option}`} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{item.name}</span>
                  <span className="text-gray-400 ml-1">({item.option}) x{item.qty}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-[#1a56db]">{formatTHB(item.unit_price * item.qty)}</span>
                  <button type="button" onClick={() => removeFromCart(item.catalogId, item.option)}
                    className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Total */}
      {cart.length > 0 && (
        <div className="bg-[#ffe033] rounded-2xl px-4 py-3 flex items-center justify-between shadow mb-4">
          <span className="font-bangers text-lg text-[#1a56db] tracking-wide">{t.totalLabel}</span>
          <span className="font-fredoka text-2xl text-[#1a56db]">{formatTHB(total)}</span>
        </div>
      )}

      {/* Checkout form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="bg-white rounded-2xl p-4 shadow flex flex-col gap-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Your Details</h2>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.nameLabel} *</label>
            <input type="text" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.phoneLabel}</label>
            <input type="tel" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.emailLabel}</label>
            <input type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]" />
          </div>
        </div>

        {/* Payment method — cash first */}
        <div className="bg-white rounded-2xl p-4 shadow">
          <label className="block text-sm font-bold text-gray-700 mb-2">{t.paymentMethodLabel}</label>
          <div className="flex flex-col gap-2">
            {[
              { value: "cash",      label: `💵 ${t.cashOption}` },
              { value: "promptpay", label: `📱 ${t.promptpayOption}` },
              { value: "stripe",    label: "💳 Credit / Debit Card" },
            ].map((opt) => (
              <label key={opt.value} className={`flex items-center gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-colors ${
                form.payment_method === opt.value ? "border-[#1a56db] bg-blue-50" : "border-gray-100"
              }`}>
                <input type="radio" name="payment_method" value={opt.value}
                  checked={form.payment_method === opt.value}
                  onChange={() => setForm({ ...form, payment_method: opt.value })}
                  className="accent-[#1a56db]" />
                <span className="text-sm font-medium">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* PromptPay panel */}
        {form.payment_method === "promptpay" && (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            {/* Header */}
            <div className="bg-[#1a56db] px-4 py-3">
              <p className="text-white font-bold text-sm">📱 PromptPay Payment</p>
            </div>
            <div className="p-4 flex flex-col gap-4">
              {/* QR + account */}
              <div className="flex gap-4 items-start">
                <div className="shrink-0">
                  <Image
                    src="/images/promptpay-qr-small.png"
                    alt="PromptPay QR"
                    width={100}
                    height={100}
                    className="rounded-xl border border-gray-100"
                  />
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <p className="font-bold text-gray-800">NinjaGym Samui</p>
                  <p className="text-gray-500 text-xs">PromptPay Phone Number</p>
                  <p className="font-mono font-bold text-[#1a56db] text-lg">086-294-4374</p>
                  {cart.length > 0 && (
                    <div className="mt-1 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
                      <p className="text-xs text-yellow-700 font-semibold">Amount to pay:</p>
                      <p className="font-fredoka text-xl text-[#1a56db]">{formatTHB(total)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Steps */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs font-bold text-gray-600 mb-2">HOW TO PAY:</p>
                <ol className="text-xs text-gray-600 space-y-1">
                  <li>1. Open your banking app</li>
                  <li>2. Scan QR code or enter phone number</li>
                  <li>3. Enter the exact amount shown above</li>
                  <li>4. Take a screenshot of your payment slip</li>
                  <li>5. Upload the slip below</li>
                </ol>
              </div>

              {/* Slip upload */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{t.uploadSlip}</label>
                <p className="text-xs text-gray-500 mb-2">{t.slipInstructions}</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSlip(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#1a56db] file:text-white file:font-semibold"
                />
                {slip && <p className="text-xs text-green-600 mt-2">✓ Selected: {slip.name}</p>}
              </div>
            </div>
          </div>
        )}

        {error && <div className="bg-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}

        <button type="submit" disabled={submitting}
          className="bg-[#22c55e] text-white font-bold text-lg rounded-2xl py-4 shadow-lg hover:bg-green-500 transition-colors disabled:opacity-50">
          {submitting
            ? t.submitting
            : form.payment_method === "stripe"
            ? "Order & Pay by Card →"
            : t.checkout}
        </button>
      </form>
    </div>
  );
}

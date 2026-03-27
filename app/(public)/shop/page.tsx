"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import { translations, Lang } from "@/lib/i18n/translations";
import { SHOP_CATALOG } from "@/lib/shop";
import { formatTHB } from "@/lib/pricing";

interface CartItem {
  catalogId: string;
  name: string;
  option: string;
  qty: number;
  unit_price: number;
}

export default function ShopPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const t = translations[lang];
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", phone: "", email: "", payment_method: "promptpay" });
  const [slip, setSlip] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("ng_lang") as Lang | null;
    if (saved) setLang(saved);
    // init selections
    const init: Record<string, string> = {};
    SHOP_CATALOG.forEach((item) => { init[item.id] = item.options.values[0]; });
    setSelections(init);
  }, []);

  function handleLang(l: Lang) { setLang(l); localStorage.setItem("ng_lang", l); }

  function addToCart(catalogId: string) {
    const item = SHOP_CATALOG.find((i) => i.id === catalogId)!;
    const option = selections[catalogId] ?? item.options.values[0];
    const key = `${catalogId}__${option}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.catalogId === catalogId && c.option === option);
      if (existing) {
        return prev.map((c) => c.catalogId === catalogId && c.option === option ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { catalogId, name: item.name, option, qty: 1, unit_price: item.price }];
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
      if (slip) body.append("slip", slip);

      const res = await fetch("/api/shop-orders", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      router.push("/shop/submitted");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-fredoka text-3xl text-white drop-shadow">{t.shopTitle}</h1>
          <p className="text-white/70 text-sm">{t.shopSubtitle}</p>
        </div>
        <LanguageSwitcher current={lang} onChange={handleLang} />
      </div>

      {/* Catalog */}
      <div className="flex flex-col gap-4 mb-6">
        {SHOP_CATALOG.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl p-4 shadow">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="font-bold text-gray-800">{item.name}</h2>
                {item.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                )}
              </div>
              <span className="font-fredoka text-lg text-[#1a56db]">{formatTHB(item.price)}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">{item.options.label}</label>
                <select
                  value={selections[item.id] ?? item.options.values[0]}
                  onChange={(e) => setSelections({ ...selections, [item.id]: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
                >
                  {item.options.values.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
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
        ))}
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
        </div>

        {/* Payment method */}
        <div className="bg-white rounded-2xl p-4 shadow">
          <label className="block text-sm font-bold text-gray-700 mb-2">{t.paymentMethodLabel}</label>
          <div className="flex flex-col gap-2">
            {[
              { value: "promptpay", label: `📱 ${t.promptpayOption}` },
              { value: "cash", label: `💵 ${t.cashOption}` },
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

        {form.payment_method === "promptpay" && (
          <div className="bg-white rounded-2xl p-4 shadow">
            <label className="block text-sm font-bold text-gray-700 mb-1">{t.uploadSlip}</label>
            <p className="text-xs text-gray-500 mb-3">{t.slipInstructions}</p>
            <input type="file" accept="image/*"
              onChange={(e) => setSlip(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#1a56db] file:text-white file:font-semibold" />
            {slip && <p className="text-xs text-green-600 mt-2">Selected: {slip.name}</p>}
          </div>
        )}

        {error && <div className="bg-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}

        <button type="submit" disabled={submitting}
          className="bg-[#22c55e] text-white font-bold text-lg rounded-2xl py-4 shadow-lg hover:bg-green-500 transition-colors disabled:opacity-50">
          {submitting ? t.submitting : t.checkout}
        </button>
      </form>
    </div>
  );
}

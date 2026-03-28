"use client";

import { useState, useEffect } from "react";
import { BASE_PRICES, MEMBERSHIP_TYPES } from "@/lib/pricing";

// Per-session base prices (used for single sessions AND bulk discount calculation)
const SESSION_BASE_ROWS = [
  { key: "price_session_group",    label: "Group Session (per session)" },
  { key: "price_day_camp",         label: "Day Camp (per session)" },
  { key: "price_session_1to1",     label: "1-to-1 Session (per session)" },
  { key: "price_all_day",          label: "All Day Pass (per session)" },
  { key: "price_combo_game_train", label: "Combo Game & Train (per session)" },
];

// Other single / monthly rows
const SINGLE_ROWS = [
  { key: "price_climb_unguided", label: "Unguided Climb Zone (20 min)" },
  { key: "price_monthly_2hr",    label: "Monthly Flex: 2 Hrs Any Day" },
  { key: "price_monthly_5hr",    label: "Monthly Flex: 5 Hrs Any Day" },
];

const BIRTHDAY_ROWS = [
  { key: "birthday_rate_morning",   label: "Morning (per hour)" },
  { key: "birthday_rate_afternoon", label: "Afternoon (per hour)" },
  { key: "birthday_rate_evening",   label: "Evening (per hour)" },
  { key: "birthday_rate_weekend",   label: "Weekend (per hour)" },
  { key: "birthday_extra_6_10",     label: "Extra kids 6–10 (flat)" },
  { key: "birthday_extra_11_15",    label: "Extra kids 11–15 (flat)" },
  { key: "birthday_extra_16_20",    label: "Extra kids 16–20 (flat)" },
];

const SHOP_ROWS = [
  { key: "price_shop_tshirt_kids",  label: "Kids T-Shirt" },
  { key: "price_shop_tshirt_adult", label: "Adult T-Shirt" },
  { key: "price_shop_shake_bake",   label: "Shake and Bake" },
];

const STATIC_BASE: Record<string, number> = {
  ...BASE_PRICES,
  price_shop_tshirt_kids:  300,
  price_shop_tshirt_adult: 300,
  price_shop_shake_bake:   200,
};

// ── Sub-components ────────────────────────────────────────────

function PriceRow({
  label,
  value,
  onChange,
  readOnly = false,
}: {
  label: string;
  value: number;
  onChange?: (v: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 gap-4">
      <label className={`text-sm flex-1 ${readOnly ? "text-gray-400" : "text-gray-700"}`}>
        {label}
      </label>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm text-gray-400 font-mono">฿</span>
        {readOnly ? (
          <span className="w-28 text-right font-mono text-sm text-gray-400 pr-1">
            {value.toLocaleString()}
          </span>
        ) : (
          <input
            type="number"
            min={0}
            step={1}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            className="w-28 border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
          />
        )}
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-100 px-5 py-3">
        <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">{title}</h2>
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const [prices, setPrices] = useState<Record<string, number>>({ ...STATIC_BASE });
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: Record<string, string | number>) => {
        const p: Record<string, number> = { ...STATIC_BASE };
        const d: Record<string, string> = {};
        for (const [k, v] of Object.entries(data)) {
          if (k.startsWith("desc_")) {
            d[k] = String(v);
          } else {
            const n = parseFloat(String(v));
            if (!isNaN(n)) p[k] = n;
          }
        }
        setPrices(p);
        setDescriptions(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handlePrice(key: string, raw: string) {
    const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(n)) setPrices((p) => ({ ...p, [key]: n }));
  }

  function handleDesc(key: string, value: string) {
    setDescriptions((d) => ({ ...d, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const payload: Record<string, number | string> = { ...prices, ...descriptions };
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const SaveButton = () => (
    <button
      onClick={handleSave}
      disabled={saving}
      className="bg-[#1a56db] hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl transition-colors"
    >
      {saving ? "Saving…" : saved ? "✓ Saved!" : "Save All"}
    </button>
  );

  if (loading) {
    return <div className="text-center py-16 text-gray-400 animate-pulse">Loading prices…</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            All prices in Thai Baht (THB). Card prices calculate automatically from the base price.
          </p>
        </div>
        <SaveButton />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6">

        {/* Per-session base prices */}
        <SectionCard title="Per-Session Prices">
          <div className="px-5 py-2 text-xs text-gray-400 border-b border-gray-50">
            Bulk session purchases discount automatically: 1% off per session (buy 10 = 10% off, max 20%).
          </div>
          {SESSION_BASE_ROWS.map(({ key, label }) => (
            <PriceRow
              key={key}
              label={label}
              value={prices[key] ?? 0}
              onChange={(v) => handlePrice(key, v)}
            />
          ))}
        </SectionCard>

        {/* Single sessions + monthly */}
        <SectionCard title="Other Single Sessions & Monthly">
          {SINGLE_ROWS.map(({ key, label }) => (
            <PriceRow
              key={key}
              label={label}
              value={prices[key] ?? 0}
              onChange={(v) => handlePrice(key, v)}
            />
          ))}
        </SectionCard>

        {/* Birthday / Events */}
        <SectionCard title="Birthday / Event Rates">
          {BIRTHDAY_ROWS.map(({ key, label }) => (
            <PriceRow
              key={key}
              label={label}
              value={prices[key] ?? 0}
              onChange={(v) => handlePrice(key, v)}
            />
          ))}
        </SectionCard>

        {/* Shop */}
        <SectionCard title="Shop Items">
          {SHOP_ROWS.map(({ key, label }) => (
            <PriceRow
              key={key}
              label={label}
              value={prices[key] ?? 0}
              onChange={(v) => handlePrice(key, v)}
            />
          ))}
        </SectionCard>

        {/* Program Descriptions */}
        <SectionCard title="Program Descriptions">
          {MEMBERSHIP_TYPES.map((mt) => {
            const descKey = `desc_${mt.id}`;
            return (
              <div key={mt.id} className="px-5 py-3">
                <p className="text-sm font-semibold text-gray-700 mb-1">{mt.label}</p>
                <textarea
                  rows={2}
                  value={descriptions[descKey] ?? mt.note ?? ""}
                  onChange={(e) => handleDesc(descKey, e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a56db] resize-none"
                />
              </div>
            );
          })}
        </SectionCard>

      </div>

      {/* Bottom save button */}
      <div className="mt-6 flex justify-end">
        <SaveButton />
      </div>
    </div>
  );
}

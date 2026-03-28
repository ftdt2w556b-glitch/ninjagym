"use client";

import { useState, useEffect } from "react";
import { BASE_PRICES, MEMBERSHIP_TYPES } from "@/lib/pricing";

// Group the price keys for display
const PRICE_SECTIONS = [
  {
    title: "Single Sessions (per kid)",
    keys: [
      { key: "price_climb_unguided",   label: "Unguided Climb Zone (20 min)" },
      { key: "price_session_group",    label: "Group Guide Session" },
      { key: "price_session_1to1",     label: "1-to-1 Private Session" },
      { key: "price_day_camp",         label: "Day Camp (10am–2pm) — per kid" },
      { key: "price_combo_game_train", label: "Combo Game & Train (2 hrs)" },
      { key: "price_all_day",          label: "All Day (max 8 hrs)" },
    ],
  },
  {
    title: "Monthly Memberships",
    keys: [
      { key: "price_monthly_2hr", label: "Monthly Flex — 2 Hrs Any Day" },
      { key: "price_monthly_5hr", label: "Monthly Flex — 5 Hrs Any Day" },
    ],
  },
  {
    title: "Group Session Cards",
    keys: [
      { key: "price_sessions_4",  label: "Group 4-Card (5% off)" },
      { key: "price_sessions_8",  label: "Group 8-Card (10% off)" },
      { key: "price_sessions_16", label: "Group 16-Card (15% off)" },
      { key: "price_sessions_20", label: "Group 20-Card (20% off)" },
    ],
  },
  {
    title: "Day Camp Cards",
    keys: [
      { key: "price_day_camp_4",  label: "Day Camp 4-Card (5% off)" },
      { key: "price_day_camp_8",  label: "Day Camp 8-Card (10% off)" },
      { key: "price_day_camp_16", label: "Day Camp 16-Card (15% off)" },
      { key: "price_day_camp_20", label: "Day Camp 20-Card (20% off)" },
    ],
  },
  {
    title: "1-to-1 Session Cards",
    keys: [
      { key: "price_sessions_1to1_4",  label: "1-to-1 4-Card (5% off)" },
      { key: "price_sessions_1to1_8",  label: "1-to-1 8-Card (10% off)" },
      { key: "price_sessions_1to1_16", label: "1-to-1 16-Card (15% off)" },
      { key: "price_sessions_1to1_20", label: "1-to-1 20-Card (20% off)" },
    ],
  },
  {
    title: "All Day Cards",
    keys: [
      { key: "price_all_day_4",  label: "All Day 4-Card (5% off)" },
      { key: "price_all_day_8",  label: "All Day 8-Card (10% off)" },
      { key: "price_all_day_16", label: "All Day 16-Card (15% off)" },
      { key: "price_all_day_20", label: "All Day 20-Card (20% off)" },
    ],
  },
  {
    title: "Combo Cards",
    keys: [
      { key: "price_combo_4",  label: "Combo 4-Card (5% off)" },
      { key: "price_combo_8",  label: "Combo 8-Card (10% off)" },
      { key: "price_combo_16", label: "Combo 16-Card (15% off)" },
      { key: "price_combo_20", label: "Combo 20-Card (20% off)" },
    ],
  },
  {
    title: "Birthday / Event Rates",
    keys: [
      { key: "birthday_rate_morning",   label: "Morning rate (per hour)" },
      { key: "birthday_rate_afternoon", label: "Afternoon rate (per hour)" },
      { key: "birthday_rate_evening",   label: "Evening rate (per hour)" },
      { key: "birthday_rate_weekend",   label: "Weekend rate (per hour)" },
      { key: "birthday_extra_6_10",     label: "Extra kids 6–10 (flat fee)" },
      { key: "birthday_extra_11_15",    label: "Extra kids 11–15 (flat fee)" },
      { key: "birthday_extra_16_20",    label: "Extra kids 16–20 (flat fee)" },
    ],
  },
];

export default function AdminSettingsPage() {
  const [prices, setPrices] = useState<Record<string, number>>({ ...BASE_PRICES });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setPrices(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleChange(key: string, value: string) {
    const num = parseInt(value.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(num)) {
      setPrices((p) => ({ ...p, [key]: num }));
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prices),
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

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400 animate-pulse">Loading prices…</div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            All prices in Thai Baht (THB). Changes go live immediately after saving.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#1a56db] hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl transition-colors"
        >
          {saving ? "Saving…" : saved ? "✓ Saved!" : "Save All Prices"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {PRICE_SECTIONS.map((section) => (
          <div key={section.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-100 px-5 py-3">
              <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">
                {section.title}
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {section.keys.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between px-5 py-3 gap-4">
                  <label className="text-sm text-gray-700 flex-1">{label}</label>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm text-gray-400 font-mono">฿</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={prices[key] ?? BASE_PRICES[key] ?? 0}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="w-28 border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Save button at bottom too */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#1a56db] hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl transition-colors"
        >
          {saving ? "Saving…" : saved ? "✓ Saved!" : "Save All Prices"}
        </button>
      </div>

      {/* Membership type notes reference */}
      <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-100 px-5 py-3">
          <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">
            Program Descriptions (read-only)
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">These appear as info tooltips on the Join form</p>
        </div>
        <div className="divide-y divide-gray-50">
          {MEMBERSHIP_TYPES.map((mt) => (
            <div key={mt.id} className="px-5 py-3">
              <p className="text-sm font-semibold text-gray-700">{mt.label}</p>
              {mt.note && <p className="text-xs text-gray-500 mt-0.5">{mt.note}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

interface InventoryItem {
  item_id: string;
  item_name: string;
  variant: string;
  stock_qty: number;
}

export default function InventoryManager({ initialItems }: { initialItems: InventoryItem[] }) {
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [saving, setSaving] = useState<string | null>(null);

  function key(i: InventoryItem) {
    return `${i.item_id}__${i.variant}`;
  }

  async function adjust(item: InventoryItem, delta: number) {
    const k = key(item);
    setSaving(k);
    const optimistic = Math.max(0, item.stock_qty + delta);
    setItems((prev) =>
      prev.map((i) => (key(i) === k ? { ...i, stock_qty: optimistic } : i))
    );
    try {
      const res = await fetch("/api/shop-inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.item_id, variant: item.variant, delta }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems((prev) =>
        prev.map((i) => (key(i) === k ? { ...i, stock_qty: data.stock_qty } : i))
      );
    } catch {
      // revert
      setItems(initialItems);
    } finally {
      setSaving(null);
    }
  }

  async function setManual(item: InventoryItem, raw: string) {
    const qty = parseInt(raw, 10);
    if (isNaN(qty) || qty < 0) return;
    const k = key(item);
    setItems((prev) =>
      prev.map((i) => (key(i) === k ? { ...i, stock_qty: qty } : i))
    );
    await fetch("/api/shop-inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: item.item_id, variant: item.variant, set_qty: qty }),
    });
  }

  // Group by item_id
  const groups: Record<string, { name: string; rows: InventoryItem[] }> = {};
  for (const item of items) {
    if (!groups[item.item_id]) groups[item.item_id] = { name: item.item_name, rows: [] };
    groups[item.item_id].rows.push(item);
  }

  const totalOut  = items.filter((i) => i.stock_qty === 0).length;
  const totalLow  = items.filter((i) => i.stock_qty > 0 && i.stock_qty <= 3).length;

  return (
    <div>
      {/* Summary badges */}
      {(totalOut > 0 || totalLow > 0) && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {totalOut > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1.5 rounded-full">
              ⛔ {totalOut} variant{totalOut !== 1 ? "s" : ""} out of stock
            </span>
          )}
          {totalLow > 0 && (
            <span className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1.5 rounded-full">
              ⚠️ {totalLow} variant{totalLow !== 1 ? "s" : ""} low stock (≤3)
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {Object.entries(groups).map(([itemId, group]) => (
          <div key={itemId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-100 px-5 py-3">
              <h3 className="font-bold text-gray-700 text-sm">{group.name}</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {group.rows.map((item) => {
                const k = key(item);
                const isOut = item.stock_qty === 0;
                const isLow = item.stock_qty > 0 && item.stock_qty <= 3;
                const isSaving = saving === k;

                return (
                  <div key={k} className="flex items-center justify-between px-5 py-2.5 gap-3">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-sm text-gray-700">{item.variant || "Default"}</span>
                      {isOut && (
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">OUT</span>
                      )}
                      {isLow && (
                        <span className="text-xs font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">LOW</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => adjust(item, -5)}
                        disabled={isSaving || item.stock_qty === 0}
                        title="-5"
                        className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-700 disabled:opacity-30 text-gray-600 text-xs font-bold transition-colors"
                      >
                        -5
                      </button>
                      <button
                        onClick={() => adjust(item, -1)}
                        disabled={isSaving || item.stock_qty === 0}
                        title="-1"
                        className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-100 hover:text-red-700 disabled:opacity-30 text-gray-700 font-bold transition-colors"
                      >
                        –
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={item.stock_qty}
                        onChange={(e) => setManual(item, e.target.value)}
                        className={`w-14 text-center border rounded-lg px-1 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1a56db] ${
                          isOut
                            ? "border-red-200 bg-red-50 text-red-700"
                            : isLow
                            ? "border-orange-200 bg-orange-50 text-orange-700"
                            : "border-gray-200"
                        }`}
                      />
                      <button
                        onClick={() => adjust(item, 1)}
                        disabled={isSaving}
                        title="+1"
                        className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-green-100 hover:text-green-700 disabled:opacity-30 text-gray-700 font-bold transition-colors"
                      >
                        +
                      </button>
                      <button
                        onClick={() => adjust(item, 5)}
                        disabled={isSaving}
                        title="+5"
                        className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-green-100 hover:text-green-700 disabled:opacity-30 text-gray-600 text-xs font-bold transition-colors"
                      >
                        +5
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

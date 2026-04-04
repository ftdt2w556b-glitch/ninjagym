"use client";

import { useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";

const CATEGORIES = [
  { value: "rent",      label: "Rent / Utilities" },
  { value: "supplies",  label: "Supplies" },
  { value: "food",      label: "Food / Staff" },
  { value: "equipment", label: "Equipment" },
  { value: "marketing", label: "Marketing" },
  { value: "other",     label: "Other" },
];

export type Expense = {
  id: number;
  expense_date: string;
  category: string;
  description: string | null;
  amount: number;
  receipt_url: string | null;
  added_by_name: string | null;
  created_at: string;
};

type Props = {
  initialExpenses: Expense[];
  from: string;
  to: string;
  supabaseUrl: string;
  canEdit: boolean;
};

export default function ExpensesSection({ initialExpenses, from, to, supabaseUrl, canEdit }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [adding, setAdding]     = useState(false);
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().split("T")[0],
    category: "other",
    description: "",
    amount: "",
    receipt_url: "",
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const uploadReceipt = async (file: File): Promise<string | null> => {
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `expense-receipts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from("expense-receipts")
      .upload(path, file, { upsert: false });
    setUploading(false);
    if (error) { alert("Receipt upload failed: " + error.message); return null; }
    return path;
  };

  const handleAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;
    setSaving(true);

    let receipt_url = form.receipt_url || null;
    if (receiptFile) {
      receipt_url = await uploadReceipt(receiptFile);
      if (!receipt_url) { setSaving(false); return; }
    }

    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: Number(form.amount), receipt_url }),
    });

    if (res.ok) {
      const newExp = await res.json();
      setExpenses((prev) => [newExp, ...prev]);
      setForm({ expense_date: new Date().toISOString().split("T")[0], category: "other", description: "", amount: "", receipt_url: "" });
      setReceiptFile(null);
      setReceiptPreview(null);
      setAdding(false);
    } else {
      alert("Failed to save expense.");
    }
    setSaving(false);
  }, [form, receiptFile]);

  const handleVoid = async (id: number) => {
    if (!confirm("Void this expense?")) return;
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (res.ok) setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const receiptFullUrl = (url: string) =>
    url.startsWith("http") ? url : `${supabaseUrl}/storage/v1/object/public/${url}`;

  const categoryLabel = (v: string) =>
    CATEGORIES.find((c) => c.value === v)?.label ?? v;

  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden mt-6">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900">Expenses</h2>
          <p className="text-xs text-gray-400 mt-0.5">For this period · included in CSV export</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-red-600">−฿{expenseTotal.toLocaleString()}</span>
          {canEdit && (
            <button
              onClick={() => setAdding((v) => !v)}
              className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-700 transition-colors"
            >
              {adding ? "Cancel" : "+ Add Expense"}
            </button>
          )}
        </div>
      </div>

      {/* Add form */}
      {adding && canEdit && (
        <form onSubmit={handleAdd} className="px-5 py-4 bg-gray-50 border-b border-gray-100 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Amount (฿)</label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
              <input
                type="text"
                placeholder="What was this for?"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Receipt (optional)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="text-sm text-gray-600"
            />
            {receiptPreview && (
              <img src={receiptPreview} alt="preview" className="mt-2 w-20 h-20 object-cover rounded-lg border border-gray-200" />
            )}
          </div>
          <button
            type="submit"
            disabled={saving || uploading}
            className="bg-gray-900 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {uploading ? "Uploading…" : saving ? "Saving…" : "Save Expense"}
          </button>
        </form>
      )}

      {/* List */}
      {expenses.length === 0 ? (
        <p className="px-5 py-8 text-center text-gray-400 text-sm">No expenses recorded for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Receipt</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(exp.expense_date + "T12:00:00").toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                      {categoryLabel(exp.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[200px]">
                    <span className="line-clamp-1">{exp.description ?? "—"}</span>
                    {exp.added_by_name && (
                      <span className="block text-xs text-gray-400">{exp.added_by_name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-red-600 text-right tabular-nums">
                    −฿{Number(exp.amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {exp.receipt_url ? (
                      <a
                        href={receiptFullUrl(exp.receipt_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View receipt"
                      >
                        <img
                          src={receiptFullUrl(exp.receipt_url)}
                          alt="receipt"
                          className="w-10 h-10 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
                          onError={(e) => {
                            // PDF or other non-image — show icon instead
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <span className="text-xs text-blue-600 underline hidden">View</span>
                      </a>
                    ) : (
                      <span className="text-gray-200 text-xs">—</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleVoid(exp.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold"
                      >
                        Void
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { MEMBERSHIP_TYPES } from "@/lib/pricing";

const STATUS_OPTIONS = [
  { value: "pending_review", label: "Pending Review" },
  { value: "cash_pending",   label: "Cash Pending" },
  { value: "approved",       label: "Approved" },
  { value: "rejected",       label: "Rejected" },
];

interface Package {
  id: number;
  membership_type: string;
  sessions_remaining: number | null;
  sessions_purchased: number | null;
  amount_paid: number | null;
  slip_status: string;
  created_at: string;
}

export default function EditMemberPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState("");
  const [packages, setPackages] = useState<Package[]>([]);
  const [packageSaving, setPackageSaving] = useState<Record<number, boolean>>({});
  const [packageError, setPackageError] = useState<Record<number, string>>({});
  const [form, setForm] = useState({
    name: "", phone: "", email: "", kids_names: "", kids_count: 1,
    membership_type: "session_group", slip_status: "approved",
    notes: "", sessions_remaining: "" as string | number, amount_paid: "" as string | number, loyalty_discount: 0,
  });

  useEffect(() => {
    fetch(`/api/members/${id}`, { method: "GET" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setForm({
          name:               data.name ?? "",
          phone:              data.phone ?? "",
          email:              data.email ?? "",
          kids_names:         data.kids_names ?? "",
          kids_count:         data.kids_count ?? 1,
          membership_type:    data.membership_type ?? "session_group",
          slip_status:        data.slip_status ?? "approved",
          notes:              data.notes ?? "",
          sessions_remaining: data.sessions_remaining ?? "",
          amount_paid:        data.amount_paid ?? "",
          loyalty_discount:   data.loyalty_discount ?? 0,
        });
        setPackages(data.packages ?? []);
      })
      .catch(() => setError("Failed to load member"))
      .finally(() => setLoading(false));
  }, [id]);

  async function savePackage(pkg: Package) {
    setPackageSaving((s) => ({ ...s, [pkg.id]: true }));
    setPackageError((e) => { const n = { ...e }; delete n[pkg.id]; return n; });
    try {
      const res = await fetch(`/api/members/${pkg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions_remaining: pkg.sessions_remaining }),
      });
      const data = await res.json();
      if (!res.ok) setPackageError((e) => ({ ...e, [pkg.id]: data.error ?? "Save failed" }));
    } finally {
      setPackageSaving((s) => { const n = { ...s }; delete n[pkg.id]; return n; });
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload: Record<string, unknown> = { ...form };
    if (payload.sessions_remaining === "") payload.sessions_remaining = null;
    else payload.sessions_remaining = Number(payload.sessions_remaining);
    if (payload.amount_paid === "") payload.amount_paid = null;
    else payload.amount_paid = Number(payload.amount_paid);

    const res = await fetch(`/api/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Save failed"); return; }
    router.push("/admin/members");
  }

  async function handleDelete() {
    if (!confirm(`Permanently delete this member record? This cannot be undone.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/members/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Delete failed"); setDeleting(false); return; }
    router.push("/admin/members");
  }

  if (loading) return <div className="text-gray-400 text-sm p-6">Loading…</div>;

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin/members" className="text-sm text-gray-400 hover:text-gray-600">← Members</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">Edit Member #{id}</h1>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm text-red-500 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete Record"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="bg-white rounded-2xl p-5 shadow flex flex-col gap-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Contact</h2>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow flex flex-col gap-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Kids</h2>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Kids Names</label>
            <input
              value={form.kids_names}
              onChange={(e) => setForm({ ...form, kids_names: e.target.value })}
              placeholder="e.g. Tom, Lisa"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Kids Count</label>
            <input
              type="number" min={1} max={10}
              value={form.kids_count}
              onChange={(e) => setForm({ ...form, kids_count: Number(e.target.value) })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow flex flex-col gap-3">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Membership</h2>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Program</label>
            <select
              value={form.membership_type}
              onChange={(e) => setForm({ ...form, membership_type: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            >
              {MEMBERSHIP_TYPES.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
            <select
              value={form.slip_status}
              onChange={(e) => setForm({ ...form, slip_status: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Sessions Remaining</label>
            <input
              type="number" min={0}
              value={form.sessions_remaining}
              onChange={(e) => setForm({ ...form, sessions_remaining: e.target.value })}
              placeholder="Leave blank if not applicable"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Amount Paid (THB)</label>
            <input
              type="number" min={0}
              value={form.amount_paid}
              onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              ⭐ Loyalty Discount (THB)
              <span className="ml-2 font-normal text-gray-400">— auto-shown to staff at check-in</span>
            </label>
            <input
              type="number" min={0}
              value={form.loyalty_discount}
              onChange={(e) => setForm({ ...form, loyalty_discount: Number(e.target.value) })}
              placeholder="0"
              className="w-full border border-yellow-300 bg-yellow-50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] resize-none"
            />
          </div>
        </div>

        {packages.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow flex flex-col gap-3">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Top-Up Packages</h2>
            <p className="text-xs text-gray-400 -mt-1">Adjust sessions on individual packages purchased by this member.</p>
            {packages.map((pkg) => {
              const label = MEMBERSHIP_TYPES.find((m) => m.id === pkg.membership_type)?.label ?? pkg.membership_type;
              const purchased = pkg.sessions_purchased != null ? `${pkg.sessions_purchased} purchased` : null;
              const date = new Date(pkg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              return (
                <div key={pkg.id} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{label}</p>
                      <p className="text-xs text-gray-400">
                        #{pkg.id} · {date}
                        {purchased ? ` · ${purchased}` : ""}
                        {" · "}
                        <span className={
                          pkg.slip_status === "approved" ? "text-green-600" :
                          pkg.slip_status === "rejected" ? "text-red-500" :
                          "text-yellow-600"
                        }>{pkg.slip_status}</span>
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {pkg.amount_paid != null ? `฿${pkg.amount_paid.toLocaleString()}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-gray-500 shrink-0">Sessions remaining</label>
                    <input
                      type="number"
                      min={0}
                      value={pkg.sessions_remaining ?? ""}
                      onChange={(e) =>
                        setPackages((prev) =>
                          prev.map((p) =>
                            p.id === pkg.id
                              ? { ...p, sessions_remaining: e.target.value === "" ? null : Number(e.target.value) }
                              : p
                          )
                        )
                      }
                      placeholder="—"
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
                    />
                    <button
                      type="button"
                      disabled={packageSaving[pkg.id]}
                      onClick={() => savePackage(pkg)}
                      className="text-xs bg-[#1a56db] text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {packageSaving[pkg.id] ? "…" : "Save"}
                    </button>
                  </div>
                  {packageError[pkg.id] && (
                    <p className="text-xs text-red-500 mt-1">{packageError[pkg.id]}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#1a56db] text-white font-bold py-3.5 rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}

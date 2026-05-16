"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Full-screen takeover shown by /admin/layout.tsx when the device has no
 * valid ng_pin_entry cookie. Any active staff PIN (pos_staff or profiles)
 * unlocks the dashboard for 4 hours on this device.
 *
 * Admin/owner sessions bypass this gate entirely — they're already
 * authenticated as a real account, no second factor needed.
 */
export default function PinEntryGate({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const router = useRouter();
  const [pin, setPin]   = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(pin)) {
      setErr("Enter your 4 to 8 digit PIN.");
      return;
    }
    setBusy(true);
    setErr(null);

    try {
      const res = await fetch("/api/staff-pin/dashboard-verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pin, purpose: "entry" }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        const mins = Number(data?.retry_after_minutes) || 30;
        setErr(`Too many wrong PINs. Try again in ${mins} min.`);
        setBusy(false);
        return;
      }
      if (!res.ok) {
        const left = data?.attempts_left;
        setErr(typeof left === "number"
          ? `Incorrect PIN. ${left} ${left === 1 ? "try" : "tries"} left.`
          : "Incorrect PIN.");
        setBusy(false);
        setPin("");
        return;
      }

      // Cookie is set server-side, refresh the layout to re-run the check.
      router.refresh();
    } catch {
      setErr("Connection problem. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#1a3a6e] to-[#0f1e3a] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-6">
          <h1 className="font-bold text-white text-3xl tracking-wide">NinjaGym</h1>
          <p className="text-white/60 text-sm mt-1">Staff Dashboard</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h2 className="font-bold text-gray-900 text-lg mb-1">Staff PIN required</h2>
          <p className="text-sm text-gray-500 mb-5">
            Enter your PIN to unlock the dashboard on this device.
          </p>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              autoComplete="off"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="••••"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-2xl font-mono tracking-[0.4em] text-center focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            />
            <button
              type="submit"
              disabled={busy || pin.length < 4}
              className="bg-[#1a56db] hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors"
            >
              {busy ? "Verifying…" : "Unlock dashboard"}
            </button>

            {err && (
              <p className="text-xs text-red-600 font-semibold text-center">{err}</p>
            )}
          </form>

          <p className="text-xs text-gray-400 mt-4 text-center">
            Unlocks for 4 hours on this device.
          </p>
        </div>

        {/* Sign out (server action) */}
        <form action={signOutAction} className="text-center mt-5">
          <button
            type="submit"
            className="text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            Sign out of NinjaGym account
          </button>
        </form>
      </div>
    </div>
  );
}

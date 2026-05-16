"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Mounted once at /admin/layout.tsx. Owns the PIN modal and exposes
 * `fetchWithPin` to every admin client component.
 *
 * Usage in a button handler:
 *
 *   const { fetchWithPin } = useStaffPin();
 *   const res = await fetchWithPin("/api/payments", { method: "POST", body });
 *
 * fetchWithPin issues the request normally. If the server responds with
 * 401 + { code: "pin_required" }, it opens the modal, waits for the user
 * to enter a valid PIN (server sets the ng_pin_write cookie), and retries
 * the original request once. Admin/owner sessions skip the modal entirely
 * because requireWritePin() bypasses them server-side.
 *
 * If the user cancels the modal, fetchWithPin returns the original 401
 * response so callers can show their own error.
 */
/**
 * writeStatus describes the current ng_pin_write cookie. The header chip
 * reads this to render '🔐 Naing · 12 min left'. null = no active cookie
 * (admin/owner sessions bypass and never carry one — chip stays hidden).
 */
export interface StaffPinWriteStatus {
  actorName: string;
  expiresAt: Date;
}

interface StaffPinContextValue {
  fetchWithPin: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  writeStatus:  StaffPinWriteStatus | null;
  /**
   * Manually open the PIN modal — used by the header chip so any staff can
   * renew the 15-minute window or swap the active actor (e.g. Win taking
   * over from Naing mid-shift). Resolves true on success, false on cancel.
   */
  openPinModal: () => Promise<boolean>;
}

const StaffPinContext = createContext<StaffPinContextValue | null>(null);

export function useStaffPin(): StaffPinContextValue {
  const ctx = useContext(StaffPinContext);
  if (!ctx) throw new Error("useStaffPin() called outside <StaffPinProvider>");
  return ctx;
}

type ModalResolver = (value: { ok: boolean; actor?: { kind: string; id: string; name: string } }) => void;

export default function StaffPinProvider({ children }: { children: ReactNode }) {
  const [open, setOpen]   = useState(false);
  const [pin, setPin]     = useState("");
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState<string | null>(null);
  const [writeStatus, setWriteStatus] = useState<StaffPinWriteStatus | null>(null);
  const resolverRef       = useRef<ModalResolver | null>(null);

  // On mount, rehydrate the write status from the server in case the cookie
  // is still alive after a page reload. Admin/owner sessions get a 200 with
  // expires_at=null (bypass), staff get either expires_at=<iso> or 401.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/staff-pin/check-write", { method: "GET" });
        if (cancelled || !res.ok) return;
        const data = await res.json().catch(() => null);
        const exp  = data?.expires_at ? new Date(data.expires_at) : null;
        if (data?.actor_name && exp && exp.getTime() > Date.now()) {
          setWriteStatus({ actorName: data.actor_name, expiresAt: exp });
        }
      } catch {
        /* network blip is fine, chip stays hidden */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-clear writeStatus when the cookie expires so the chip vanishes
  // exactly when the next write would re-prompt the PIN modal.
  useEffect(() => {
    if (!writeStatus) return;
    const ms = writeStatus.expiresAt.getTime() - Date.now();
    if (ms <= 0) { setWriteStatus(null); return; }
    const t = setTimeout(() => setWriteStatus(null), ms);
    return () => clearTimeout(t);
  }, [writeStatus]);

  const closeModal = useCallback((value: Parameters<ModalResolver>[0]) => {
    if (resolverRef.current) {
      const r = resolverRef.current;
      resolverRef.current = null;
      r(value);
    }
    setOpen(false);
    setPin("");
    setErr(null);
    setBusy(false);
  }, []);

  /** Opens the modal and resolves with the verify outcome. */
  const askForPin = useCallback((): Promise<{ ok: boolean }> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve as ModalResolver;
      setOpen(true);
    });
  }, []);

  const fetchWithPin = useCallback<StaffPinContextValue["fetchWithPin"]>(async (input, init) => {
    let res = await fetch(input, init);
    if (res.status !== 401) return res;

    // Need to clone, the original body is consumed when caller reads it.
    const data = await res.clone().json().catch(() => ({} as Record<string, unknown>));
    if (data?.code !== "pin_required") return res;

    const outcome = await askForPin();
    if (!outcome.ok) return res; // user cancelled, surface original 401

    // Retry the request — write cookie is now set.
    return fetch(input, init);
  }, [askForPin]);

  async function submitPin(e: React.FormEvent) {
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
        body:    JSON.stringify({ pin, purpose: "write" }),
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
        setPin("");
        setBusy(false);
        return;
      }
      // Capture the freshly-issued write window so the header chip can
      // start counting down without a second round-trip.
      const exp = data?.expires_at ? new Date(data.expires_at) : null;
      if (data?.actor?.name && exp && exp.getTime() > Date.now()) {
        setWriteStatus({ actorName: data.actor.name, expiresAt: exp });
      }
      closeModal({ ok: true, actor: data?.actor });
    } catch {
      setErr("Connection problem. Please try again.");
      setBusy(false);
    }
  }

  /** Public helper for the header chip + any other "renew/swap now" trigger. */
  const openPinModal = useCallback(async () => {
    const outcome = await askForPin();
    return !!outcome.ok;
  }, [askForPin]);

  return (
    <StaffPinContext.Provider value={{ fetchWithPin, writeStatus, openPinModal }}>
      {children}

      {/* PIN modal portal */}
      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center px-4"
          onClick={() => closeModal({ ok: false })}
        >
          <div
            className="w-full max-w-xs bg-white rounded-2xl shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-gray-900 text-base mb-1">Confirm with PIN</h3>
            <p className="text-xs text-gray-500 mb-4">
              Your PIN identifies who performed this action.
            </p>
            <form onSubmit={submitPin} className="flex flex-col gap-3">
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => closeModal({ ok: false })}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || pin.length < 4}
                  className="flex-1 bg-[#1a56db] hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                >
                  {busy ? "…" : "Confirm"}
                </button>
              </div>
              {err && (
                <p className="text-xs text-red-600 font-semibold text-center">{err}</p>
              )}
            </form>
          </div>
        </div>
      )}
    </StaffPinContext.Provider>
  );
}

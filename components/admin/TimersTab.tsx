"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MEMBERSHIP_TYPES } from "@/lib/pricing";
import { getProgramDuration } from "@/lib/program-duration";

// ─── Types ────────────────────────────────────────────────────────────────

type AutoTimer = {
  id: number;
  memberId: number | null;
  memberName: string;
  kidsCount: number;
  kidsNames: string | null;
  membershipType: string;
  startedAt: string;
};

type CustomTimer = {
  id: number;
  name: string;
  minutes: number;
  startedAt: string;
};

type ApiResponse = {
  serverNow: string;
  daycampEndTime: string;
  autoTimers: AutoTimer[];
  customTimers: CustomTimer[];
};

type RenderTimer = {
  key: string;          // "auto:123" | "custom:456"
  kind: "auto" | "custom";
  rawId: number;
  title: string;
  subtitle: string | null;
  endsAtMs: number;
};

// ─── Bangkok-time helpers ─────────────────────────────────────────────────

function bangkokTodayAtMs(hour: number, minute: number): number {
  const bkkNow = new Date(Date.now() + 7 * 3600 * 1000);
  const y = bkkNow.getUTCFullYear();
  const m = String(bkkNow.getUTCMonth() + 1).padStart(2, "0");
  const d = String(bkkNow.getUTCDate()).padStart(2, "0");
  const h = String(hour).padStart(2, "0");
  const mn = String(minute).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T${h}:${mn}:00+07:00`).getTime();
}

function formatRemaining(ms: number): string {
  const sign = ms < 0 ? "-" : "";
  const abs = Math.abs(ms);
  const totalSec = Math.floor(abs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${sign}${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}

// ─── Soft chime via WebAudio (no asset) ───────────────────────────────────

function playChime() {
  try {
    const W = window as Window & {
      webkitAudioContext?: typeof AudioContext;
      __ngAudioCtx?: AudioContext;
    };
    const Ctx = window.AudioContext || W.webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = W.__ngAudioCtx ?? new Ctx();
    W.__ngAudioCtx = ctx;
    if (ctx.state === "suspended") ctx.resume();

    const t0 = ctx.currentTime;
    // Two-tone bell: E5 + A5
    [659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = t0 + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 1.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1.3);
    });
  } catch {
    // Browser blocked it — silent fail
  }
}

// ─── Component ────────────────────────────────────────────────────────────

const POLL_MS = 30_000;
const DISMISSED_KEY = "ng_timers_dismissed_v1";

export default function TimersTab() {
  const [data, setData]   = useState<ApiResponse | null>(null);
  const [, setTick]       = useState(0); // forces re-render every second
  const [loading, setLoading] = useState(true);
  const [err, setErr]     = useState<string | null>(null);

  // Custom-timer form
  const [name, setName]   = useState("");
  const [mins, setMins]   = useState("");
  const [adding, setAdding] = useState(false);

  // Track the highest "overdue minute" we've already chimed for each timer key.
  // -1 means never chimed. 0 = chimed at expiry, 1 = chimed at 1-min overdue, etc.
  // This drives the every-minute repeat chime for negative timers until they're dismissed.
  const chimedOverdueRef = useRef<Map<string, number>>(new Map());
  // Track dismissed auto-timer keys (persisted in localStorage; cleared next day)
  const [dismissedAuto, setDismissedAuto] = useState<Set<string>>(new Set());

  // Load dismissed-set from localStorage (only keep today's entries — Bangkok day)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { day: string; ids: string[] };
      const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
      if (parsed.day === today) setDismissedAuto(new Set(parsed.ids));
      else localStorage.removeItem(DISMISSED_KEY);
    } catch {
      // ignore
    }
  }, []);

  const persistDismissed = useCallback((next: Set<string>) => {
    const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify({ day: today, ids: [...next] }));
    } catch {
      // ignore
    }
  }, []);

  // Fetch timers (poll every 30s, plus immediate refresh on mount)
  const fetchTimers = useCallback(async () => {
    try {
      const res = await fetch("/api/timers", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ApiResponse = await res.json();
      setData(json);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimers();
    const id = setInterval(fetchTimers, POLL_MS);
    return () => clearInterval(id);
  }, [fetchTimers]);

  // 1-Hz tick for live countdown
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Build the merged render list
  const timers: RenderTimer[] = useMemo(() => {
    if (!data) return [];
    const list: RenderTimer[] = [];

    for (const t of data.autoTimers) {
      const key = `auto:${t.id}`;
      if (dismissedAuto.has(key)) continue;
      const dur = getProgramDuration(t.membershipType, data.daycampEndTime);
      if (!dur) continue;
      const startMs = new Date(t.startedAt).getTime();
      let endsAtMs: number;
      if (dur.kind === "minutes") {
        endsAtMs = startMs + dur.minutes * 60_000;
      } else {
        endsAtMs = bangkokTodayAtMs(dur.hour, dur.minute);
      }
      const programLabel =
        MEMBERSHIP_TYPES.find((m) => m.id === t.membershipType)?.label ?? t.membershipType;
      const title = t.kidsNames
        ? (t.kidsCount > 1 ? `${t.kidsNames} (${t.kidsCount})` : t.kidsNames)
        : t.memberName;
      list.push({
        key,
        kind: "auto",
        rawId: t.id,
        title,
        subtitle: programLabel,
        endsAtMs,
      });
    }

    for (const c of data.customTimers) {
      list.push({
        key: `custom:${c.id}`,
        kind: "custom",
        rawId: c.id,
        title: c.name,
        subtitle: `${c.minutes} min`,
        endsAtMs: new Date(c.startedAt).getTime() + c.minutes * 60_000,
      });
    }

    return list.sort((a, b) => a.endsAtMs - b.endsAtMs);
  }, [data, dismissedAuto]);

  // Chime when a timer crosses zero, then re-chime every minute it stays overdue
  // until the user dismisses it. We don't spam the chime for timers that were
  // already overdue at page load — we just align with the next minute mark.
  const loadedAtRef = useRef<number>(Date.now());
  useEffect(() => {
    const now = Date.now();
    for (const t of timers) {
      const remaining = t.endsAtMs - now;
      if (remaining > 0) continue;
      const overdueMin = Math.floor(-remaining / 60_000); // 0 at expiry, 1 after 1 min, ...
      const last = chimedOverdueRef.current.get(t.key);
      if (last === undefined) {
        // First time we're seeing this timer. If it expired before the page loaded,
        // suppress the catch-up chime by recording the current overdue minute.
        if (t.endsAtMs < loadedAtRef.current) {
          chimedOverdueRef.current.set(t.key, overdueMin);
        } else {
          chimedOverdueRef.current.set(t.key, overdueMin);
          playChime();
        }
      } else if (overdueMin > last) {
        chimedOverdueRef.current.set(t.key, overdueMin);
        playChime();
      }
    }
  });

  // ── Actions ──────────────────────────────────────────────────────────────

  async function addCustom(e: React.FormEvent) {
    e.preventDefault();
    const m = parseInt(mins, 10);
    if (!name.trim() || isNaN(m) || m < 1) return;
    setAdding(true);
    try {
      const res = await fetch("/api/timers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), minutes: m }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed");
      }
      setName("");
      setMins("");
      await fetchTimers();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setAdding(false);
    }
  }

  async function dismiss(t: RenderTimer) {
    if (t.kind === "custom") {
      await fetch("/api/timers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.rawId }),
      });
      await fetchTimers();
    } else {
      const next = new Set(dismissedAuto);
      next.add(t.key);
      setDismissedAuto(next);
      persistDismissed(next);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const now = Date.now();

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Timers</h1>
      <p className="text-sm text-gray-500 mb-6">
        Auto-starts when staff approves a check-in. Close only after departure.
      </p>

      {/* Custom timer form */}
      <form
        onSubmit={addCustom}
        className="flex flex-wrap items-end gap-2 mb-6 bg-white border border-gray-200 rounded-xl p-4"
      >
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Custom timer name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Musashi, Hanzo and Kawasaki"
            maxLength={60}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
          />
        </div>
        <div className="w-24">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Minutes</label>
          <input
            type="number"
            min={1}
            max={1440}
            value={mins}
            onChange={(e) => setMins(e.target.value)}
            placeholder="60"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
          />
        </div>
        <button
          type="submit"
          disabled={adding || !name.trim() || !mins}
          className="bg-[#1a56db] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {adding ? "Starting…" : "Start"}
        </button>
      </form>

      {err && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
          {err}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
      ) : timers.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          No active timers. They start automatically when a kid is checked in.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {timers.map((t) => {
            const remaining = t.endsAtMs - now;
            const expired = remaining <= 0;
            const warning = !expired && remaining <= 5 * 60_000;
            const tone = expired
              ? "border-red-300 bg-red-50"
              : warning
              ? "border-amber-300 bg-amber-50"
              : "border-emerald-300 bg-emerald-50";
            const numTone = expired
              ? "text-red-700"
              : warning
              ? "text-amber-700"
              : "text-emerald-700";
            return (
              <li
                key={t.key}
                className={`border rounded-xl p-4 flex flex-col gap-1 ${tone}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{t.title}</p>
                    {t.subtitle && (
                      <p className="text-xs text-gray-600 truncate">{t.subtitle}</p>
                    )}
                  </div>
                  <button
                    onClick={() => dismiss(t)}
                    aria-label="Dismiss"
                    className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1 -mr-1"
                  >
                    ×
                  </button>
                </div>
                <div className={`text-3xl font-mono font-bold tabular-nums ${numTone}`}>
                  {formatRemaining(remaining)}
                </div>
                <p className="text-[11px] text-gray-500">
                  {expired ? "Expired" : warning ? "Ending soon" : "Running"}
                  {t.kind === "custom" && " · custom"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

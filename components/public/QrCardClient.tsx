"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";
import ShareButton from "@/components/public/ShareButton";
import TopUpSection from "@/components/public/TopUpSection";
import LanguageSwitcher from "@/components/public/LanguageSwitcher";
import UseSessionButton from "@/components/public/UseSessionButton";
import { useLanguage } from "@/lib/i18n/useLanguage";

interface CheckIn {
  id: number;
  check_in_at: string;
  notes: string | null;
  member_id?: number;
}

interface Photo {
  id: number;
  file_path: string;
  caption: string | null;
  tags: string[] | null;
}

interface ActivePackage {
  id: number;
  membership_type: string;
  membership_label: string;
  sessions_remaining: number | null;
  expires_at: string | null;
  time_based: boolean;
  is_bulk?: boolean;
  created_at: string;
  amount_paid?: number | null;
}

// ── Streak helpers ────────────────────────────────────────────────────────────
function getWeekKey(isoStr: string): string {
  // Convert UTC → Bangkok (UTC+7), return ISO date of that week's Monday
  const d = new Date(new Date(isoStr).getTime() + 7 * 3600 * 1000);
  const dow = d.getUTCDay();
  const toMon = dow === 0 ? 6 : dow - 1;
  const mon = new Date(d.getTime() - toMon * 86400000);
  return mon.toISOString().slice(0, 10);
}

function computeStreak(checkIns: { check_in_at: string }[]): number {
  if (!checkIns.length) return 0;
  const weeks = new Set(checkIns.map((c) => getWeekKey(c.check_in_at)));
  const thisMonday = getWeekKey(new Date().toISOString());
  const lastMonday = new Date(new Date(thisMonday + "T12:00:00Z").getTime() - 7 * 86400000)
    .toISOString().slice(0, 10);
  let cur = weeks.has(thisMonday) ? thisMonday : lastMonday;
  if (!weeks.has(cur)) return 0;
  let streak = 0;
  while (weeks.has(cur)) {
    streak++;
    cur = new Date(new Date(cur + "T12:00:00Z").getTime() - 7 * 86400000)
      .toISOString().slice(0, 10);
  }
  return streak;
}

// ── Calendar helpers ──────────────────────────────────────────────────────────
interface CalDay { dateStr: string; hasCheckIn: boolean; isToday: boolean; isFuture: boolean }

function buildCalendar(checkIns: { check_in_at: string }[]): CalDay[][] {
  const ciDates = new Set(
    checkIns.map((c) => {
      const d = new Date(new Date(c.check_in_at).getTime() + 7 * 3600 * 1000);
      return d.toISOString().slice(0, 10);
    })
  );
  const bkkNow  = new Date(Date.now() + 7 * 3600 * 1000);
  const todayStr = bkkNow.toISOString().slice(0, 10);
  const dow      = bkkNow.getUTCDay();
  const toMon    = dow === 0 ? 6 : dow - 1;
  const thisMon  = bkkNow.getTime() - toMon * 86400000;
  const startMs  = thisMon - 5 * 7 * 86400000; // 6 weeks back from this Monday
  const days: CalDay[] = Array.from({ length: 42 }, (_, i) => {
    const ds = new Date(startMs + i * 86400000).toISOString().slice(0, 10);
    return { dateStr: ds, hasCheckIn: ciDates.has(ds), isToday: ds === todayStr, isFuture: ds > todayStr };
  });
  return Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7));
}

// ── Milestone helpers ─────────────────────────────────────────────────────────
const MILESTONES = [10, 25, 50, 100, 200, 500];
function getTopMilestone(n: number) {
  return [...MILESTONES].reverse().find((m) => n >= m) ?? null;
}
function getNextMilestone(n: number) {
  return MILESTONES.find((m) => m > n) ?? null;
}

// ── Belt rank system ─────────────────────────────────────────────────────────
// Belt rank advances by check-in count. Free sessions earned by THB spent (every 3,500 THB).
const BELTS = [
  { label: "White Belt",  emoji: "🤍", min: 0,   max: 4   },
  { label: "Yellow Belt", emoji: "💛", min: 5,   max: 9   },
  { label: "Orange Belt", emoji: "🧡", min: 10,  max: 19  },
  { label: "Green Belt",  emoji: "💚", min: 20,  max: 34  },
  { label: "Blue Belt",   emoji: "💙", min: 35,  max: 49  },
  { label: "Purple Belt", emoji: "💜", min: 50,  max: 74  },
  { label: "Brown Belt",  emoji: "🤎", min: 75,  max: 99  },
  { label: "Black Belt",  emoji: "🖤", min: 100, max: Infinity },
] as const;

function getBelt(totalCheckIns: number): typeof BELTS[number] {
  let found: typeof BELTS[number] = BELTS[0];
  for (const b of BELTS) { if (totalCheckIns >= b.min) found = b; }
  return found;
}

function getBeltProgress(totalCheckIns: number): { pct: number; next: typeof BELTS[number] | null } {
  const belt = getBelt(totalCheckIns);
  if (belt.max === Infinity) return { pct: 100, next: null };
  const range = (belt.max as number) - belt.min + 1;
  const within = totalCheckIns - belt.min;
  const pct = Math.min(100, Math.round((within / range) * 100));
  const idx = BELTS.findIndex((b) => b.min === belt.min);
  const next = (BELTS[idx + 1] ?? null) as typeof BELTS[number] | null;
  return { pct, next };
}

interface Props {
  member: {
    id: number;
    name: string;
    phone: string | null;
    email?: string | null;
    membership_type: string;
    sessions_remaining: number | null;
    slip_status: string;
    kids_names: string | null;
    kids_count: number | null;
    created_at: string;
    pin?: number | null;
  };
  membershipLabel: string;
  siteUrl: string;
  supabaseUrl: string;
  fromAdmin: boolean;
  checkIns: CheckIn[];
  photos: Photo[];
  activePackages: ActivePackage[];
  pastPackages?: ActivePackage[];
  cardToken: string;
  totalCheckIns: number;
  uniqueCheckInDays: number;
  freeSessionsRedeemed: number;
  notifyPrefs?: { checkin?: boolean; low_sessions?: boolean; milestone?: boolean } | null;
  loyaltyDiscount?: number;
  prices?: Record<string, number>;
  descriptions?: Record<string, string>;
  pendingTopUp?: { id: number; membership_label: string; amount_paid: number | null; payment_method: string | null } | null;
}

// ── Sessions list with collapse for past purchases ────────────────────────────
const PAST_PREVIEW = 3;

function SessionsList({
  activePackages,
  pastPackages,
}: {
  activePackages: { id: number; membership_label: string; sessions_remaining: number | null; sessions_purchased?: number | null; expires_at: string | null; created_at: string; amount_paid?: number | null; time_based?: boolean }[];
  pastPackages:   { id: number; membership_label: string; sessions_remaining: number | null; sessions_purchased?: number | null; expires_at: string | null; created_at: string; amount_paid?: number | null; time_based?: boolean }[];
}) {
  const [showAll, setShowAll] = useState(false);
  const visiblePast = showAll ? pastPackages : pastPackages.slice(0, PAST_PREVIEW);
  const hiddenCount = pastPackages.length - PAST_PREVIEW;

  function statusText(pkg: typeof activePackages[number], isActive: boolean) {
    if (pkg.time_based) {
      if (pkg.expires_at) {
        const d = new Date(pkg.expires_at);
        const expired = d < new Date();
        const label = d.toLocaleDateString("en-US", { timeZone: "Asia/Bangkok", month: "short", day: "numeric", year: "numeric" });
        return expired ? `Expired ${label}` : `Expires ${label}`;
      }
      return isActive ? "Active" : "Pending activation";
    }
    if (pkg.sessions_remaining !== null) {
      if (pkg.sessions_remaining === 0) return "Used";
      const rem = pkg.sessions_remaining;
      const total = pkg.sessions_purchased ?? null;
      return total && total > rem
        ? `${rem} of ${total} left`
        : `${rem} session${rem !== 1 ? "s" : ""} left`;
    }
    return isActive ? "Active" : "Used";
  }

  function PkgRow({ pkg, isActive }: { pkg: typeof activePackages[number]; isActive: boolean }) {
    return (
      <div className="flex items-center justify-between py-2.5">
        <div>
          <p className={`text-sm font-medium ${isActive ? "text-gray-800" : "text-gray-400"}`}>
            {pkg.membership_label}
          </p>
          <p className="text-xs text-gray-400">
            {new Date(pkg.created_at).toLocaleDateString("en-US", {
              timeZone: "Asia/Bangkok", month: "short", day: "numeric", year: "numeric",
            })}
            {pkg.amount_paid ? ` · ${Number(pkg.amount_paid).toLocaleString()} THB` : ""}
            {pkg.sessions_purchased ? ` · Bought ${pkg.sessions_purchased}` : ""}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
        }`}>
          {statusText(pkg, isActive)}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-4 bg-white rounded-2xl p-5 shadow">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">My Sessions</p>
      <div className="flex flex-col divide-y divide-gray-50">
        {activePackages.map((pkg) => <PkgRow key={pkg.id} pkg={pkg} isActive={true} />)}
        {visiblePast.map((pkg) => <PkgRow key={pkg.id} pkg={pkg} isActive={false} />)}
      </div>
      {hiddenCount > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline w-full text-center"
        >
          Show {hiddenCount} older {hiddenCount === 1 ? "record" : "records"}
        </button>
      )}
      {showAll && pastPackages.length > PAST_PREVIEW && (
        <button
          onClick={() => setShowAll(false)}
          className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline w-full text-center"
        >
          Show less
        </button>
      )}
    </div>
  );
}

export default function QrCardClient({
  member,
  membershipLabel,
  siteUrl,
  supabaseUrl,
  fromAdmin,
  checkIns,
  photos,
  activePackages,
  pastPackages = [],
  cardToken,
  totalCheckIns,
  uniqueCheckInDays,
  freeSessionsRedeemed,
  notifyPrefs,
  loyaltyDiscount = 0,
  prices,
  descriptions,
  pendingTopUp,
}: Props) {
  const { t, lang, setLang } = useLanguage();
  type RedeemPhase = "idle" | "submitting" | "pending" | "approved" | "rejected";
  const [redeemPhase, setRedeemPhase]   = useState<RedeemPhase>("idle");
  const [redeemPendingId, setRedeemPendingId] = useState<number | null>(null);
  const [localRedeemed, setLocalRedeemed] = useState(freeSessionsRedeemed);
  const [localPrefs, setLocalPrefs]     = useState({
    checkin:      notifyPrefs?.checkin      ?? false,
    low_sessions: notifyPrefs?.low_sessions ?? true,
    milestone:    notifyPrefs?.milestone    ?? true,
  });
  const [savingPrefs, setSavingPrefs]   = useState(false);

  // Realtime subscription for free loyalty session approval
  useEffect(() => {
    if (!redeemPendingId) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`redeem-${redeemPendingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pending_checkins", filter: `id=eq.${redeemPendingId}` },
        (payload) => {
          const s = (payload.new as { status: string }).status;
          if (s === "approved") {
            setLocalRedeemed((v) => v + 1);
            setRedeemPhase("approved");
          } else if (s === "rejected") {
            setRedeemPhase("rejected");
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [redeemPendingId]);

  async function handleTogglePref(key: keyof typeof localPrefs) {
    const updated = { ...localPrefs, [key]: !localPrefs[key] };
    setLocalPrefs(updated);
    setSavingPrefs(true);
    try {
      await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notify_prefs: updated }),
      });
    } finally {
      setSavingPrefs(false);
    }
  }

  const isApproved = member.slip_status === "approved";
  const isRejected = member.slip_status === "rejected";
  const isPending  = !isApproved && !isRejected;
  const firstName  = member.name.split(" ")[0];

  // ── Streak / calendar / milestone calcs ──────────────────────────────────
  const streak         = computeStreak(checkIns);
  const calWeeks       = buildCalendar(checkIns);
  const topMilestone   = getTopMilestone(totalCheckIns);
  const nextMilestone  = getNextMilestone(totalCheckIns);
  const isNewMilestone = MILESTONES.includes(totalCheckIns) && totalCheckIns > 0;

  // ── Loyalty calcs ─────────────────────────────────────────────────────────
  // Belt rank: based on total check-ins (counts multiple kids per day accurately).
  // Free sessions: based on unique Bangkok calendar days — max 1 pip per day per family.
  const FREE_SESSION_CHECKINS = 10;
  const sessionsInCycle   = uniqueCheckInDays % FREE_SESSION_CHECKINS;
  const freeSessionsEarned    = Math.floor(uniqueCheckInDays / FREE_SESSION_CHECKINS);
  const pipsToShow     = sessionsInCycle === 0 && uniqueCheckInDays > 0 && freeSessionsEarned > localRedeemed
    ? 10
    : sessionsInCycle;
  const freeSessionsAvailable = Math.max(0, freeSessionsEarned - localRedeemed);
  const belt        = getBelt(totalCheckIns);
  const { pct: beltPct, next: nextBelt } = getBeltProgress(totalCheckIns);

  async function handleRedeem() {
    if (redeemPhase !== "idle" || freeSessionsAvailable < 1) return;
    if (!confirm(t.redeemConfirm)) return;
    setRedeemPhase("submitting");
    try {
      const res = await fetch(`/api/members/${member.id}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cardToken, kids_names: member.kids_names, totalCheckIns }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        setRedeemPendingId(data.id);
        setRedeemPhase("pending");
      } else {
        alert(data.error ?? t.redeemError);
        setRedeemPhase("idle");
      }
    } catch {
      alert(t.redeemConnectionError);
      setRedeemPhase("idle");
    }
  }

  // Multi-package selection — default to first active package, or parent
  const defaultId = activePackages.length > 0 ? activePackages[0].id : member.id;
  const [selectedId, setSelectedId] = useState<number>(defaultId);

  const selectedPkg = activePackages.find((p) => p.id === selectedId) ?? activePackages[0];
  const hasMultiple = activePackages.length > 1;

  return (
    <div className="px-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {fromAdmin ? (
            <Link href="/admin/members" className="text-white/70 text-sm hover:text-white">
              ← Members
            </Link>
          ) : (
            <Link href="/" className="text-white/70 text-sm hover:text-white">
              {t.back}
            </Link>
          )}
          <Image src="/images/logo_small.png" alt="NinjaGym" width={36} height={36} />
        </div>
        <LanguageSwitcher current={lang} onChange={setLang} />
      </div>

      {/* Welcome hero */}
      <div className="text-center mb-5">
        <div className="text-5xl mb-2">🥷</div>
        <h1
          className="font-bangers text-4xl text-[#ffe033] tracking-wide drop-shadow-lg"
          style={{ textShadow: "1px 2px 0px rgba(0,0,0,0.3)" }}
        >
          {t.qrWelcome} {firstName}!
        </h1>
      </div>

      {/* Milestone celebration banner */}
      {isApproved && isNewMilestone && (
        <div className="bg-[#ffe033]/15 border border-[#ffe033]/40 rounded-2xl px-4 py-3 mb-4 text-center">
          <p className="text-3xl mb-1">🎉</p>
          <p className="text-[#ffe033] font-bold text-base">
            {totalCheckIns} Session Milestone!
          </p>
          <p className="text-white/60 text-xs mt-0.5">
            You&apos;ve trained {totalCheckIns} times at NinjaGym. Legendary!
          </p>
        </div>
      )}

      {/* Payment status banners */}
      {isPending && (
        <div className="bg-white/15 border border-white/20 rounded-2xl px-4 py-3 mb-4 flex items-start gap-3">
          <span className="text-xl mt-0.5">⏳</span>
          <div>
            <p className="text-white font-bold text-sm">{t.statusPaymentReview}</p>
            <p className="text-white/70 text-xs leading-relaxed">{t.statusPaymentNote}</p>
          </div>
        </div>
      )}
      {isRejected && (
        <div className="bg-orange-500/20 border border-orange-400/30 rounded-2xl px-4 py-3 mb-4 flex items-start gap-3">
          <span className="text-xl mt-0.5">⚠️</span>
          <div>
            <p className="text-orange-200 font-bold text-sm">Program selection needs to be corrected</p>
            <p className="text-orange-200/70 text-xs">Please scroll down and select the correct program below. Your member card stays active.</p>
          </div>
        </div>
      )}

      {/* QR Card */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* Card header */}
        <div className="bg-[#1a56db] px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm leading-tight">{t.qrCardTitle}</p>
            <p className="text-white/60 text-xs mt-0.5">Use this to book, record and top-up sessions</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            isApproved
              ? "bg-green-400 text-green-900"
              : isRejected
              ? "bg-red-400 text-red-900"
              : "bg-yellow-300 text-yellow-900"
          }`}>
            {isApproved ? t.statusActive : isRejected ? t.statusRejected : t.statusPending}
          </span>
        </div>

        {/* Member info */}
        <div className="px-5 pt-5 pb-2">
          <h2 className="font-fredoka text-2xl text-gray-900 leading-tight">{member.name}</h2>
          {/* Show selected active package label, or "NinjaGym Member" when no active packages */}
          <p className="text-sm text-[#1a56db] font-semibold mt-0.5">
            {selectedPkg ? selectedPkg.membership_label : activePackages.length === 0 ? "NinjaGym Member" : membershipLabel}
          </p>
          {member.kids_names && (
            <p className="text-xs text-gray-400 mt-1">{t.qrKids}: {member.kids_names}</p>
          )}
        </div>

        {/* Multi-package selector */}
        {hasMultiple && (
          <div className="px-5 pb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              Today&apos;s Program
            </p>
            <div className="flex flex-col gap-1.5">
              {activePackages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedId(pkg.id)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-colors ${
                    selectedId === pkg.id
                      ? "border-[#1a56db] bg-blue-50"
                      : "border-gray-100 hover:bg-gray-50"
                  }`}
                >
                  <span className={`text-sm font-medium ${
                    selectedId === pkg.id ? "text-[#1a56db]" : "text-gray-700"
                  }`}>
                    {pkg.membership_label}
                  </span>
                  <span className="flex items-center gap-2">
                    {pkg.time_based ? (
                      pkg.expires_at ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          new Date(pkg.expires_at) < new Date(Date.now() + 3 * 86400000)
                            ? "bg-orange-100 text-orange-600"
                            : "bg-green-100 text-green-700"
                        }`}>
                          Exp {new Date(pkg.expires_at).toLocaleDateString("en-US", { timeZone: "Asia/Bangkok", month: "short", day: "numeric" })}
                        </span>
                      ) : (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          Active
                        </span>
                      )
                    ) : pkg.sessions_remaining !== null ? (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        pkg.sessions_remaining <= 2
                          ? "bg-orange-100 text-orange-600"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {pkg.sessions_remaining} left
                      </span>
                    ) : null}
                    {selectedId === pkg.id && (
                      <span className="text-[#1a56db] text-sm">✓</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Select the program you&apos;re using today.
            </p>
          </div>
        )}

        {/* PIN display */}
        {member.pin && (
          <div className="mx-5 mb-4 bg-gray-900 rounded-2xl px-5 py-4 text-center">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">
              Your Check-In PIN
            </p>
            <div className="flex justify-center gap-3 mb-2">
              {String(member.pin).padStart(4, "0").split("").map((d, i) => (
                <span
                  key={i}
                  className="font-mono text-4xl font-bold text-[#ffe033] leading-none"
                >
                  {d}
                </span>
              ))}
            </div>
            <p className="text-gray-500 text-xs">Use this at the front desk kiosk</p>
          </div>
        )}

        {/* Member ID + sessions/expiry row */}
        <div className="px-5 pb-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">{t.qrMemberId}</p>
            <p className="font-bold text-gray-700 text-lg">#{member.id}</p>
          </div>
          {selectedPkg?.time_based ? (
            selectedPkg.expires_at ? (
              <div className="text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Expires</p>
                <p className={`font-bold text-sm ${
                  new Date(selectedPkg.expires_at) < new Date(Date.now() + 3 * 86400000)
                    ? "text-orange-500"
                    : "text-[#1a56db]"
                }`}>
                  {new Date(selectedPkg.expires_at).toLocaleDateString("en-US", {
                    timeZone: "Asia/Bangkok", month: "short", day: "numeric", year: "numeric",
                  })}
                </p>
              </div>
            ) : null
          ) : selectedPkg?.sessions_remaining !== null && selectedPkg?.sessions_remaining !== undefined ? (
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{t.qrSessionsLeft}</p>
              <p className={`font-bold text-2xl ${
                selectedPkg.sessions_remaining <= 2 ? "text-orange-500" : "text-[#1a56db]"
              }`}>
                {selectedPkg.sessions_remaining}
              </p>
            </div>
          ) : null}
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{t.qrRegistered}</p>
            <p className="text-xs font-semibold text-gray-600">
              {new Date(member.created_at).toLocaleDateString("en-US", {
                timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-5 py-3 text-center border-t border-gray-100">
          {loyaltyDiscount > 0 && (
            <p className="text-xs font-bold text-yellow-600 mb-1">⭐ Loyalty member — ฿{loyaltyDiscount} off each program</p>
          )}
          <p className="text-xs text-gray-400">Rick Tew&apos;s NinjaGym</p>
          <span className="sr-only">Koh Samui, Thailand</span>
        </div>
      </div>


      {/* ── Use Session — parent-initiated check-in ─────────────── */}
      {(() => {
        // Use the package the parent selected in "Today's Program" if it's usable,
        // otherwise fall back to the first usable package.
        const usablePkg =
          (selectedPkg && !selectedPkg.time_based && selectedPkg.sessions_remaining !== null && selectedPkg.sessions_remaining > 0)
            ? selectedPkg
            : activePackages.find((p) => !p.time_based && p.sessions_remaining !== null && p.sessions_remaining > 0);
        if (!usablePkg) return null;
        return (
          <UseSessionButton
            memberId={usablePkg.id}
            authMemberId={member.id}
            memberName={member.name}
            membershipLabel={usablePkg.membership_label}
            sessionsRemaining={usablePkg.sessions_remaining ?? 0}
            maxKids={member.kids_count ?? 1}
            defaultKidsNames={member.kids_names ?? ""}
            cardToken={cardToken}
          />
        );
      })()}

      <ShareButton
        url={`${siteUrl}/qr/card/${member.id}?token=${cardToken}`}
        title={`${member.name}: NinjaGym Member Card`}
      />

      {/* ── Ninja Rank & Loyalty ── */}
      {isApproved && (
        <div className="mt-4 bg-gray-900 rounded-2xl p-5 shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ninja Rank</p>
            <span className="text-xs text-gray-500">{totalCheckIns} total check-ins</span>
          </div>

          {/* Belt badge */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{belt.emoji}</span>
            <div className="flex-1">
              <p className="text-white font-bold text-lg leading-tight">{belt.label}</p>
              {nextBelt ? (
                <p className="text-gray-400 text-xs">
                  {nextBelt.min - totalCheckIns} more check-in{nextBelt.min - totalCheckIns !== 1 ? "s" : ""} to {nextBelt.label}
                </p>
              ) : (
                <p className="text-[#ffe033] text-xs font-semibold">Master rank achieved! 🥷</p>
              )}
            </div>
          </div>

          {/* XP progress bar */}
          {nextBelt && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{belt.label}</span>
                <span>{nextBelt.label}</span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#ffe033] to-[#ffb347] rounded-full transition-all duration-700"
                  style={{ width: `${beltPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Free session tracker — every 10 check-ins */}
          <div className="border-t border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Free Sessions</p>
              <p className="text-xs text-gray-500">Every 10 sessions</p>
            </div>
            {/* Pip track — 10 pips, each = 1 check-in */}
            <div className="flex gap-1.5 mb-3">
              {Array.from({ length: 10 }).map((_, i) => {
                const filled = i < pipsToShow;
                return (
                  <div
                    key={i}
                    className={`flex-1 h-2.5 rounded-full ${filled ? "bg-[#ffe033]" : "bg-gray-700"}`}
                  />
                );
              })}
            </div>
            <p className="text-xs text-gray-400 text-center mb-3">
              {sessionsInCycle === 0 && freeSessionsAvailable > 0
                ? "🎉 Free session ready! Keep training!"
                : `${sessionsInCycle}/10 ${t.freeSessionProgress}`}
            </p>

            {/* Free session redeem — phase-aware states */}
            {redeemPhase === "pending" && (
              <div className="bg-amber-500/10 border border-amber-400/40 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl mb-1">⏳</p>
                <p className="text-amber-300 font-bold text-sm">{t.redeemPending}</p>
                <p className="text-amber-400/60 text-xs mt-0.5">{t.redeemPendingNote}</p>
              </div>
            )}

            {redeemPhase === "approved" && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl mb-1">✅</p>
                <p className="text-green-400 font-bold text-sm">{t.redeemApproved}</p>
                <p className="text-green-400/70 text-xs mt-0.5">{t.redeemHaveFun}, {firstName}!</p>
              </div>
            )}

            {redeemPhase === "rejected" && (
              <div className="bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl mb-1">❌</p>
                <p className="text-red-400 font-bold text-sm">{t.redeemRejected}</p>
                <button
                  onClick={() => setRedeemPhase("idle")}
                  className="text-xs text-gray-500 underline mt-2"
                >
                  {t.redeemTryAgain}
                </button>
              </div>
            )}

            {(redeemPhase === "idle" || redeemPhase === "submitting") && freeSessionsAvailable > 0 && (
              <div className="bg-[#ffe033]/10 border border-[#ffe033]/30 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[#ffe033] font-bold text-sm">
                    🎁 {freeSessionsAvailable} {t.redeemBtn}{freeSessionsAvailable !== 1 ? "" : ""} Ready!
                  </p>
                  <p className="text-[#ffe033]/60 text-xs mt-0.5">{t.redeemReadyNote}</p>
                </div>
                <button
                  onClick={handleRedeem}
                  disabled={redeemPhase === "submitting"}
                  className="ml-3 bg-[#ffe033] text-gray-900 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-yellow-300 disabled:opacity-50 transition-colors shrink-0"
                >
                  {redeemPhase === "submitting" ? "..." : t.redeemBtn}
                </button>
              </div>
            )}

            {freeSessionsAvailable === 0 && (
              <p className="text-center text-gray-600 text-xs">
                Earned {freeSessionsEarned} free session{freeSessionsEarned !== 1 ? "s" : ""} · {localRedeemed} redeemed
              </p>
            )}
          </div>
        </div>
      )}


      {/* My Sessions — purchase history */}
      {(activePackages.length > 0 || pastPackages.length > 0) && (
        <SessionsList activePackages={activePackages} pastPackages={pastPackages} />
      )}

      {/* Top-up / Continue Training / Recent Check-ins */}
      {/* Also shown when rejected so parent can re-register with correct program */}
      {(isApproved || isRejected) && (
        <TopUpSection
          memberId={member.id}
          memberName={member.name}
          prices={prices}
          descriptions={descriptions}
          memberPhone={member.phone ?? null}
          memberEmail={member.email ?? null}
          currentType={member.membership_type}
          defaultKids={member.kids_count ?? 1}
          activePackages={activePackages}
          loyaltyDiscount={loyaltyDiscount}
          cardToken={cardToken}
          dbPendingTopUp={pendingTopUp ?? null}
        />
      )}

      {/* Approved marketing photos */}
      {photos.length > 0 && (
        <div className="mt-6">
          <h2 className="font-fredoka text-xl text-white drop-shadow mb-3">📸 {t.qrPhotos}</h2>
          <div className="grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="rounded-2xl overflow-hidden shadow-lg bg-white">
                <div className="relative aspect-square">
                  <Image
                    src={`${supabaseUrl}/storage/v1/object/public/marketing-photos/${photo.file_path}`}
                    alt={photo.caption ?? "NinjaGym action photo"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 480px) 50vw, 200px"
                  />
                </div>
                {photo.caption && (
                  <p className="text-xs text-gray-500 px-3 py-2 truncate">{photo.caption}</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-white/50 text-xs text-center mt-3">{t.qrPhotosHiRes}</p>
        </div>
      )}

      {/* ── Notification Preferences ── */}
      {isApproved && member.email && (
        <div className="mt-4 bg-white rounded-2xl p-5 shadow">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">🔔 Email Notifications</p>
            {savingPrefs && <span className="text-xs text-gray-400">Saving…</span>}
          </div>
          <div className="flex flex-col divide-y divide-gray-50">
            {([
              { key: "checkin"      as const, label: "Check-in confirmation",   hint: "Email each time a session is recorded" },
              { key: "low_sessions" as const, label: "Low sessions warning",    hint: "Alert when you have 2 sessions left" },
              { key: "milestone"    as const, label: "Session milestones",      hint: "Celebrate 10, 25, 50, 100+ visits" },
            ]).map(({ key, label, hint }) => (
              <div key={key} className="flex items-center justify-between py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700">{label}</p>
                  <p className="text-xs text-gray-400 truncate">{hint}</p>
                </div>
                <button
                  onClick={() => handleTogglePref(key)}
                  className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                    localPrefs[key] ? "bg-[#1a56db]" : "bg-gray-200"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    localPrefs[key] ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Sent to {member.email}</p>
        </div>
      )}
    </div>
  );
}

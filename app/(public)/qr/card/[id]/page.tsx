import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { MEMBERSHIP_TYPES } from "@/lib/pricing";
import QrCardClient from "@/components/public/QrCardClient";
import { verifyMemberToken, signMemberId } from "@/lib/member-token";
import { readSignedCookie, WRITE_COOKIE, readWriteCookieFull } from "@/lib/staff-pin";
import MemberCardPinWall from "@/components/admin/MemberCardPinWall";

export default async function QrCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; token?: string }>;
}) {
  const { id } = await params;
  const { from, token } = await searchParams;
  const memberId = Number(id);

  // ── Access control ───────────────────────────────────────────────
  // Allow:
  //   • valid signed parent token, or
  //   • logged-in admin/owner (PIN bypass — same as every other write surface), or
  //   • logged-in staff/manager WITH a valid ng_pin_write cookie.
  //
  // Staff without a fresh PIN window get a wall page that bounces them
  // back to /admin/members. Without this check, anyone who knows the
  // URL pattern /qr/card/[id]?from=admin could side-step the Members
  // reveal gate entirely with one click on the table row.
  const fromAdmin       = from === "admin";
  const hasValidToken   = verifyMemberToken(memberId, token);

  if (!hasValidToken) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      redirect("/my-membership");
    }
    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = profile?.role ?? "";
    const isStaffLike = ["admin", "owner", "manager", "staff"].includes(role);
    if (!isStaffLike) redirect("/my-membership");

    // Manager / staff hitting this from the admin link must have a
    // fresh PIN window. Admin / owner always pass through.
    const needsPin = fromAdmin && role !== "admin" && role !== "owner";
    if (needsPin) {
      const cookieStore = await cookies();
      const writeOk = !!readWriteCookieFull(cookieStore.get(WRITE_COOKIE)?.value);
      if (!writeOk) {
        // Avoid an unused-import warning while keeping the helper around
        // for any future entry-cookie reuse.
        void readSignedCookie;
        return <MemberCardPinWall />;
      }
    }
  }

  const admin = createAdminClient();

  const { data: member } = await admin
    .from("member_registrations")
    .select("id, name, phone, email, membership_type, sessions_remaining, sessions_purchased, slip_status, kids_names, kids_count, created_at, parent_member_id, expires_at, amount_paid, pin, free_sessions_redeemed, notify_prefs, loyalty_discount")
    .eq("id", id)
    .single();

  if (!member) notFound();

  // Top-up records redirect to the parent card (preserve token for parent)
  if (member.parent_member_id) {
    const parentToken = signMemberId(member.parent_member_id);
    redirect(`/qr/card/${member.parent_member_id}?token=${parentToken}`);
  }

  // Fetch ALL top-ups (approved) for history + active detection
  // AND the most recent pending top-up so the parent can self-cancel from any device
  const [{ data: topUps }, { data: pendingTopUpRows }] = await Promise.all([
    admin
      .from("member_registrations")
      .select("id, membership_type, sessions_remaining, sessions_purchased, slip_status, created_at, expires_at, amount_paid")
      .eq("parent_member_id", Number(id))
      .eq("slip_status", "approved")
      .order("created_at", { ascending: false }),
    admin
      .from("member_registrations")
      .select("id, membership_type, amount_paid, payment_method, slip_status")
      .eq("parent_member_id", Number(id))
      .in("slip_status", ["pending_review", "cash_pending"])
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const pendingTopUpRaw = pendingTopUpRows?.[0] ?? null;
  const pendingTopUp = pendingTopUpRaw ? {
    id:               pendingTopUpRaw.id as number,
    membership_label: MEMBERSHIP_TYPES.find((m) => m.id === pendingTopUpRaw.membership_type)?.label ?? String(pendingTopUpRaw.membership_type),
    amount_paid:      (pendingTopUpRaw.amount_paid as number | null) ?? null,
    payment_method:   (pendingTopUpRaw.payment_method as string | null) ?? null,
  } : null;

  const allRelated = [
    {
      id: member.id,
      membership_type: member.membership_type,
      sessions_remaining: member.sessions_remaining,
      sessions_purchased: member.sessions_purchased ?? null,
      slip_status: member.slip_status,
      created_at: member.created_at,
      expires_at: member.expires_at ?? null,
      amount_paid: member.amount_paid ?? null,
    },
    ...(topUps ?? []).map((r) => ({ ...r, expires_at: r.expires_at ?? null, amount_paid: r.amount_paid ?? null, sessions_purchased: r.sessions_purchased ?? null })),
  ];

  const allIds = allRelated.map((r) => r.id);

  // Fetch attendance, photos, and all check-in kids data in parallel
  const [{ data: photos }, { data: checkInsRaw }, { data: allCheckInKids }] = await Promise.all([
    admin
      .from("marketing_photos")
      .select("id, file_path, caption, tags")
      .eq("member_id", Number(id))
      .eq("approved", true)
      .order("created_at", { ascending: false }),
    admin
      .from("attendance_logs")
      .select("id, check_in_at, notes, member_id")
      .in("member_id", allIds)
      .order("check_in_at", { ascending: false })
      .limit(60),
    // Fetch kids_count + date for ALL check-ins (no limit) to correctly sum loyalty sessions
    admin
      .from("attendance_logs")
      .select("kids_count, notes, membership_type, check_in_at")
      .in("member_id", allIds),
  ]);

  const checkIns = checkInsRaw ?? [];

  // Each check-in may cover multiple kids, sum them for loyalty/belt accuracy
  // Unguided Climb Zone (20 min) does NOT count toward free sessions
  function kidsFromLog(r: { kids_count?: number | null; notes?: string | null; membership_type?: string | null }) {
    if (r.membership_type === "climb_unguided") return 0;
    if (r.membership_type === "free_session_loyalty") return 0;
    if (r.kids_count && r.kids_count > 1) return r.kids_count;
    const m = r.notes?.match(/\|\s*(\d+)\s*kids/i);
    return m ? parseInt(m[1], 10) : 1;
  }
  const totalCheckIns = (allCheckInKids ?? []).reduce((sum, r) => sum + kidsFromLog(r), 0);

  // Free sessions: max 1 pip per day per family (unique Bangkok dates, not per-kid count)
  const uniqueCheckInDays = new Set(
    (allCheckInKids ?? [])
      .filter((r) => r.membership_type !== "climb_unguided" && r.membership_type !== "free_session_loyalty")
      .map((r) => {
        if (!r.check_in_at) return null;
        const d = new Date(new Date(r.check_in_at as string).getTime() + 7 * 3600 * 1000);
        return d.toISOString().slice(0, 10);
      })
      .filter((d): d is string => d !== null)
  ).size;

  // Registration IDs that have at least one check-in (for legacy null-sessions detection)
  const usedRegIds = new Set(checkIns.map((c) => c.member_id));

  const now = new Date();

  function packageIsActive(r: { membership_type: string; sessions_remaining: number | null; expires_at: string | null; id: number }) {
    const mt = MEMBERSHIP_TYPES.find((m) => m.id === r.membership_type);
    if (mt?.timeBased) return !r.expires_at || new Date(r.expires_at) > now;
    if (mt?.bulk) return r.sessions_remaining !== null && r.sessions_remaining > 0;
    if (r.sessions_remaining !== null) return r.sessions_remaining > 0;
    return !usedRegIds.has(r.id); // legacy null: active only if never checked in
  }

  function mapPackage(r: typeof allRelated[0]) {
    const mt = MEMBERSHIP_TYPES.find((m) => m.id === r.membership_type);
    return {
      id: r.id,
      membership_type: r.membership_type,
      membership_label: mt?.label ?? r.membership_type,
      sessions_remaining: r.sessions_remaining,
      sessions_purchased: r.sessions_purchased ?? null,
      expires_at: r.expires_at,
      time_based: !!mt?.timeBased,
      is_bulk: !!mt?.bulk,
      created_at: r.created_at,
      amount_paid: r.amount_paid,
    };
  }

  const activePackages = allRelated
    .filter((r) => r.slip_status === "approved" && packageIsActive(r))
    .map(mapPackage)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const pastPackages = allRelated
    .filter((r) => r.slip_status === "approved" && !packageIsActive(r) && (r.amount_paid ?? 0) > 0)
    .map(mapPackage)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const membershipLabel =
    MEMBERSHIP_TYPES.find((m) => m.id === member.membership_type)?.label ??
    member.membership_type;

  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ninjagym.com";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const cardToken   = signMemberId(member.id);

  // Fetch live prices and descriptions from settings so program list reflects admin changes
  const { data: settingsRows } = await admin
    .from("settings")
    .select("key, value")
    .or("key.like.price_%,key.like.desc_%");
  const prices: Record<string, number> = {};
  const descriptions: Record<string, string> = {};
  for (const row of settingsRows ?? []) {
    const key = row.key as string;
    if (key.startsWith("price_")) prices[key] = Number(row.value);
    else if (key.startsWith("desc_")) descriptions[key] = row.value as string;
  }

  // Belt perks are re-earnable. We tally how many times this family has redeemed
  // each perk type so the client can compute the next eligibility threshold
  // (belt.min × (count + 1)). family_id = parent registration (member.id here,
  // since the top-up redirect above resolved any child rows back to the parent).
  const { data: redeemedRows } = await admin
    .from("member_perks_redeemed")
    .select("perk_type")
    .eq("family_id", member.id);
  const redeemedPerkCounts: Record<string, number> = {};
  for (const r of redeemedRows ?? []) {
    const key = r.perk_type as string;
    redeemedPerkCounts[key] = (redeemedPerkCounts[key] ?? 0) + 1;
  }

  return (
    <QrCardClient
      member={member}
      membershipLabel={membershipLabel}
      siteUrl={siteUrl}
      supabaseUrl={supabaseUrl}
      fromAdmin={fromAdmin}
      checkIns={checkIns}
      photos={photos ?? []}
      activePackages={activePackages}
      pastPackages={pastPackages}
      cardToken={cardToken}
      totalCheckIns={totalCheckIns ?? 0}
      uniqueCheckInDays={uniqueCheckInDays}
      freeSessionsRedeemed={member.free_sessions_redeemed ?? 0}
      notifyPrefs={member.notify_prefs ?? null}
      loyaltyDiscount={(member as { loyalty_discount?: number | null }).loyalty_discount ?? 0}
      prices={prices}
      descriptions={descriptions}
      pendingTopUp={pendingTopUp}
      redeemedPerkCounts={redeemedPerkCounts}
    />
  );
}

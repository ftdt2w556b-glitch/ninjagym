import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { MEMBERSHIP_TYPES } from "@/lib/pricing";
import QrCardClient from "@/components/public/QrCardClient";
import { verifyMemberToken, signMemberId } from "@/lib/member-token";

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
  // Allow: valid signed token  OR  logged-in admin/staff
  const hasValidToken = verifyMemberToken(memberId, token);

  if (!hasValidToken) {
    // Check if a logged-in admin/staff is accessing
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const adminClient = createAdminClient();
      const { data: profile } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const isStaff = profile && ["admin", "owner", "manager", "staff"].includes(profile.role);
      if (!isStaff) redirect("/my-membership");
    } else {
      redirect("/my-membership");
    }
  }

  const fromAdmin = from === "admin";
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("member_registrations")
    .select("id, name, phone, email, membership_type, sessions_remaining, sessions_purchased, slip_status, kids_names, kids_count, created_at, parent_member_id, expires_at, amount_paid, pin, free_sessions_redeemed, notify_prefs")
    .eq("id", id)
    .single();

  if (!member) notFound();

  // Top-up records redirect to the parent card (preserve token for parent)
  if (member.parent_member_id) {
    const parentToken = signMemberId(member.parent_member_id);
    redirect(`/qr/card/${member.parent_member_id}?token=${parentToken}`);
  }

  // Fetch ALL top-ups (approved) for history + active detection
  const { data: topUps } = await admin
    .from("member_registrations")
    .select("id, membership_type, sessions_remaining, sessions_purchased, slip_status, created_at, expires_at, amount_paid")
    .eq("parent_member_id", Number(id))
    .eq("slip_status", "approved")
    .order("created_at", { ascending: false });

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
    // Fetch kids_count for ALL check-ins (no limit) to correctly sum loyalty sessions
    admin
      .from("attendance_logs")
      .select("kids_count, notes, membership_type")
      .in("member_id", allIds),
  ]);

  const checkIns = checkInsRaw ?? [];

  // Each check-in may cover multiple kids — sum them for loyalty/belt accuracy
  // Unguided Climb Zone (20 min) does NOT count toward free sessions
  function kidsFromLog(r: { kids_count?: number | null; notes?: string | null; membership_type?: string | null }) {
    if (r.membership_type === "climb_unguided") return 0;
    if (r.kids_count && r.kids_count > 1) return r.kids_count;
    const m = r.notes?.match(/\|\s*(\d+)\s*kids/i);
    return m ? parseInt(m[1], 10) : 1;
  }
  const totalCheckIns = (allCheckInKids ?? []).reduce((sum, r) => sum + kidsFromLog(r), 0);

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
    .filter((r) => r.slip_status === "approved" && !packageIsActive(r))
    .map(mapPackage)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const membershipLabel =
    MEMBERSHIP_TYPES.find((m) => m.id === member.membership_type)?.label ??
    member.membership_type;

  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ninjagym.com";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const cardToken   = signMemberId(member.id);

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
      freeSessionsRedeemed={member.free_sessions_redeemed ?? 0}
      notifyPrefs={member.notify_prefs ?? null}
    />
  );
}

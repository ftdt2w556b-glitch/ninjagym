import { createAdminClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { MEMBERSHIP_TYPES } from "@/lib/pricing";
import QrCardClient from "@/components/public/QrCardClient";

export default async function QrCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const fromAdmin = from === "admin";
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("member_registrations")
    .select("id, name, phone, email, membership_type, sessions_remaining, slip_status, kids_names, kids_count, created_at, parent_member_id, expires_at")
    .eq("id", id)
    .single();

  if (!member) notFound();

  // Top-up records redirect to the parent card
  if (member.parent_member_id) {
    redirect(`/qr/card/${member.parent_member_id}`);
  }

  // Fetch all approved top-ups for this member
  const { data: topUps } = await admin
    .from("member_registrations")
    .select("id, membership_type, sessions_remaining, slip_status, created_at, expires_at")
    .eq("parent_member_id", Number(id))
    .eq("slip_status", "approved")
    .order("created_at", { ascending: false });

  const allRelated = [
    {
      id: member.id,
      membership_type: member.membership_type,
      sessions_remaining: member.sessions_remaining,
      slip_status: member.slip_status,
      created_at: member.created_at,
      expires_at: member.expires_at ?? null,
    },
    ...(topUps ?? []).map((r) => ({ ...r, expires_at: r.expires_at ?? null })),
  ];

  const allIds = allRelated.map((r) => r.id);

  // Fetch attendance and photos in parallel
  const [{ data: photos }, { data: checkInsRaw }] = await Promise.all([
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
      .limit(20),
  ]);

  const checkIns = checkInsRaw ?? [];

  // Registration IDs that have at least one check-in (for legacy null-sessions detection)
  const usedRegIds = new Set(checkIns.map((c) => c.member_id));

  const now = new Date();

  const activePackages = allRelated
    .filter((r) => r.slip_status === "approved")
    .filter((r) => {
      const mt = MEMBERSHIP_TYPES.find((m) => m.id === r.membership_type);
      if (mt?.timeBased) {
        // Time-based: active if not yet expired (or no expiry set yet)
        return !r.expires_at || new Date(r.expires_at) > now;
      }
      if (mt?.bulk) {
        // Bulk: active if sessions remain
        return r.sessions_remaining !== null && r.sessions_remaining > 0;
      }
      // Single-use: active if sessions_remaining > 0,
      // OR if legacy null and never checked in yet
      if (r.sessions_remaining !== null) return r.sessions_remaining > 0;
      return !usedRegIds.has(r.id);
    })
    .map((r) => {
      const mt = MEMBERSHIP_TYPES.find((m) => m.id === r.membership_type);
      return {
        id: r.id,
        membership_type: r.membership_type,
        membership_label: mt?.label ?? r.membership_type,
        sessions_remaining: r.sessions_remaining,
        expires_at: r.expires_at,
        time_based: !!mt?.timeBased,
        created_at: r.created_at,
      };
    });

  const membershipLabel =
    MEMBERSHIP_TYPES.find((m) => m.id === member.membership_type)?.label ??
    member.membership_type;

  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return (
    <QrCardClient
      member={member}
      membershipLabel={membershipLabel}
      siteUrl={siteUrl}
      supabaseUrl={supabaseUrl}
      fromAdmin={fromAdmin}
      checkIns={checkIns.slice(0, 10)}
      photos={photos ?? []}
      activePackages={activePackages}
    />
  );
}

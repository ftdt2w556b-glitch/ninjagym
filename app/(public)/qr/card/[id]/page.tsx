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
    .select("id, name, phone, email, membership_type, sessions_remaining, slip_status, kids_names, kids_count, created_at, parent_member_id")
    .eq("id", id)
    .single();

  if (!member) notFound();

  // Top-up payment records redirect to the parent (main) card
  if (member.parent_member_id) {
    redirect(`/qr/card/${member.parent_member_id}`);
  }

  // Fetch all approved top-up registrations for this member
  const { data: topUps } = await admin
    .from("member_registrations")
    .select("id, membership_type, sessions_remaining, slip_status, created_at")
    .eq("parent_member_id", Number(id))
    .eq("slip_status", "approved")
    .order("created_at", { ascending: false });

  // Build active packages: parent + approved top-ups with sessions remaining
  const allRelated = [
    { id: member.id, membership_type: member.membership_type, sessions_remaining: member.sessions_remaining, slip_status: member.slip_status, created_at: member.created_at },
    ...(topUps ?? []),
  ];

  const activePackages = allRelated
    .filter((r) => r.slip_status === "approved")
    .filter((r) => r.sessions_remaining === null || r.sessions_remaining > 0)
    .map((r) => ({
      id: r.id,
      membership_type: r.membership_type,
      membership_label:
        MEMBERSHIP_TYPES.find((m) => m.id === r.membership_type)?.label ?? r.membership_type,
      sessions_remaining: r.sessions_remaining,
      created_at: r.created_at,
    }));

  // Attendance across ALL related registrations (parent + top-ups)
  const allIds = allRelated.map((r) => r.id);

  const [{ data: photos }, { data: checkIns }] = await Promise.all([
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
      .limit(10),
  ]);

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
      checkIns={checkIns ?? []}
      photos={photos ?? []}
      activePackages={activePackages}
    />
  );
}

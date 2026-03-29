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
    .select("id, name, phone, membership_type, sessions_remaining, slip_status, kids_names, kids_count, created_at, parent_member_id")
    .eq("id", id)
    .single();

  if (!member) notFound();

  // Top-up payment records redirect to the parent (main) card
  if (member.parent_member_id) {
    redirect(`/qr/card/${member.parent_member_id}`);
  }

  const [{ data: photos }, { data: checkIns }] = await Promise.all([
    admin
      .from("marketing_photos")
      .select("id, file_path, caption, tags")
      .eq("member_id", Number(id))
      .eq("approved", true)
      .order("created_at", { ascending: false }),
    admin
      .from("attendance_logs")
      .select("id, check_in_at, notes")
      .eq("member_id", Number(id))
      .order("check_in_at", { ascending: false })
      .limit(8),
  ]);

  const membershipLabel =
    MEMBERSHIP_TYPES.find((m) => m.id === member.membership_type)?.label ??
    member.membership_type;

  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const qrValue     = `${siteUrl}/scanner?member=${member.id}`;

  return (
    <QrCardClient
      member={member}
      membershipLabel={membershipLabel}
      qrValue={qrValue}
      siteUrl={siteUrl}
      supabaseUrl={supabaseUrl}
      fromAdmin={fromAdmin}
      checkIns={checkIns ?? []}
      photos={photos ?? []}
    />
  );
}

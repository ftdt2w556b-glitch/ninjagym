import { NextResponse } from "next/server";
import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/checkin/enrich
 * Accepts { memberIds: number[] } and returns a map of member enrichment data
 * (pin, parent_member_id, sessions_remaining) using the admin client to bypass RLS.
 * Requires a valid staff Supabase session.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberIds } = await request.json() as { memberIds: number[] };
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return NextResponse.json({});
  }

  const admin = createAdminClient();

  const { data: members } = await admin
    .from("member_registrations")
    .select("id, pin, parent_member_id, sessions_remaining")
    .in("id", memberIds);

  type MemberInfo = { pin?: string | null; parent_member_id?: number | null; sessions_remaining?: number | null };
  const memberMap: Record<number, MemberInfo> = {};
  for (const m of members ?? []) {
    memberMap[m.id] = { pin: m.pin, parent_member_id: m.parent_member_id, sessions_remaining: m.sessions_remaining };
  }

  // Fetch parent rows for PIN traversal (top-up registrations have no PIN themselves)
  const parentIds = [...new Set(
    Object.values(memberMap)
      .filter((m) => !m.pin && m.parent_member_id)
      .map((m) => m.parent_member_id as number)
  )];
  if (parentIds.length > 0) {
    const { data: parents } = await admin
      .from("member_registrations")
      .select("id, pin")
      .in("id", parentIds);
    for (const p of parents ?? []) {
      memberMap[p.id] = { ...memberMap[p.id], pin: p.pin };
    }
  }

  return NextResponse.json(memberMap);
}

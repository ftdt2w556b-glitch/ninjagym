import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireAdmin(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "owner", "manager"].includes(profile.role)) return null;
  return user;
}

/** GET /api/members/[id] — fetch a single member (admin only) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("member_registrations")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

/** PATCH /api/members/[id] — update member fields (admin only) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const allowed = [
    "name", "phone", "email", "kids_names", "kids_count",
    "membership_type", "slip_status", "notes", "sessions_remaining", "amount_paid",
    "free_sessions_redeemed", "notify_prefs", "loyalty_discount",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // When manually approving, stamp the review timestamp
  if (updates.slip_status === "approved") {
    updates.slip_reviewed_at = new Date().toISOString();
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("member_registrations")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sync name / email changes back to historical attendance_log snapshots
  const logSync: Record<string, unknown> = {};
  if ("name" in updates) logSync.member_name = updates.name;
  if ("email" in updates) logSync.member_email = updates.email;
  if (Object.keys(logSync).length > 0) {
    await admin.from("attendance_logs").update(logSync).eq("member_id", Number(id));
  }

  return NextResponse.json({ success: true });
}

/** DELETE /api/members/[id] — permanently remove a member (admin only) */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const admin = createAdminClient();

  // Delete child top-up records first (linked via parent_member_id)
  const { data: children } = await admin
    .from("member_registrations")
    .select("id")
    .eq("parent_member_id", id);
  for (const child of children ?? []) {
    await admin.from("attendance_logs").delete().eq("member_id", child.id);
    await admin.from("member_registrations").delete().eq("id", child.id);
  }

  // Delete remaining related records
  await admin.from("attendance_logs").delete().eq("member_id", id);
  await admin.from("cash_sales").delete().eq("reference_id", id);

  const { error } = await admin
    .from("member_registrations")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

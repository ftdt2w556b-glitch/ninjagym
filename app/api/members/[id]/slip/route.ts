import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

/** POST /api/members/[id]/slip — staff uploads a slip for an existing registration */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager", "staff", "owner"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const formData = await request.formData();
  const slipFile = formData.get("slip") as File | null;

  if (!slipFile || slipFile.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = slipFile.name.split(".").pop() ?? "jpg";
  const fileName = `slip_${id}_${Date.now()}.${ext}`;
  const buffer = Buffer.from(await slipFile.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("slips")
    .upload(fileName, buffer, { contentType: slipFile.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  await admin.from("member_registrations").update({
    slip_image: fileName,
    slip_uploaded_at: new Date().toISOString(),
    slip_status: "pending_review",
  }).eq("id", Number(id));

  return NextResponse.json({ success: true, slip_image: fileName });
}

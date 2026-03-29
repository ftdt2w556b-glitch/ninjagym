import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

// POST: upload a marketing photo (staff only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("photo") as File | null;
    const caption = formData.get("caption") as string | null;
    const member_id = formData.get("member_id") ? Number(formData.get("member_id")) : null;
    const booking_id = formData.get("booking_id") ? Number(formData.get("booking_id")) : null;
    const tagsRaw = formData.get("tags") as string | null;
    const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No photo provided" }, { status: 400 });
    }

    const admin = createAdminClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const fileName = `photo_${Date.now()}_${user.id.slice(0,8)}.${ext}`;
    const buffer = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from("marketing-photos")
      .upload(fileName, buffer, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data, error } = await admin
      .from("marketing_photos")
      .insert({
        file_path: fileName,
        caption: caption || null,
        member_id,
        booking_id,
        uploaded_by: user.id,
        tags,
        approved: false,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ id: data.id, file_path: fileName });
  } catch (err: unknown) {
    console.error("POST /api/photos error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

// PATCH: approve or delete a photo (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, action, member_id } = await request.json();
    const admin = createAdminClient();

    if (action === "approve") {
      await admin
        .from("marketing_photos")
        .update({
          approved: true,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          // Assign member if provided during approval (may be null to clear)
          ...(member_id !== undefined ? { member_id: member_id || null } : {}),
        })
        .eq("id", id);
    } else if (action === "unapprove") {
      await admin
        .from("marketing_photos")
        .update({ approved: false, approved_by: null, approved_at: null })
        .eq("id", id);
    } else if (action === "delete") {
      const { data: photo } = await admin
        .from("marketing_photos")
        .select("file_path")
        .eq("id", id)
        .single();
      if (photo) {
        await admin.storage.from("marketing-photos").remove([photo.file_path]);
      }
      await admin.from("marketing_photos").delete().eq("id", id);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

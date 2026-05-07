import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

async function isPosUnlocked() {
  const cookieStore = await cookies();
  const posAuth = cookieStore.get("pos_auth")?.value;
  if (!posAuth) return false;
  const admin = createAdminClient();
  const { data } = await admin.from("settings").select("value").eq("key", "pos_password").maybeSingle();
  const expected = data?.value ?? process.env.POS_PASSWORD ?? null;
  return expected ? posAuth === expected : posAuth === "unlocked";
}

export async function POST(request: NextRequest) {
  if (!(await isPosUnlocked())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { staffId, pin, staffType } = await request.json();
  if (!staffId) {
    return NextResponse.json({ error: "Missing staffId" }, { status: 400 });
  }

  const admin = createAdminClient();

  // POS-only staff (pos_staff table)
  if (staffType === "pos") {
    const posId = Number(String(staffId).replace("pos:", ""));
    const { data: posStaff } = await admin
      .from("pos_staff")
      .select("pin_hash")
      .eq("id", posId)
      .single();

    if (!posStaff?.pin_hash) {
      return NextResponse.json({ error: "PIN required. Ask admin to set one." }, { status: 401 });
    }
    const match = await bcrypt.compare(pin, posStaff.pin_hash);
    if (!match) return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
    return NextResponse.json({ ok: true });
  }

  // Dashboard profile users (existing logic)
  if (!pin) return NextResponse.json({ error: "Missing pin" }, { status: 400 });
  const { data: profile } = await admin
    .from("profiles")
    .select("pin")
    .eq("id", staffId)
    .single();

  if (!profile?.pin) {
    return NextResponse.json({ ok: true }); // no PIN set — allow through
  }
  const match = await bcrypt.compare(pin, profile.pin);
  if (!match) return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  return NextResponse.json({ ok: true });
}

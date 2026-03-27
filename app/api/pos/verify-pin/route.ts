import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  const { staffId, pin } = await request.json();
  if (!staffId || !pin) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("pin")
    .eq("id", staffId)
    .single();

  if (!profile?.pin) {
    // No PIN set — allow through
    return NextResponse.json({ ok: true });
  }

  const match = await bcrypt.compare(pin, profile.pin);
  if (!match) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}

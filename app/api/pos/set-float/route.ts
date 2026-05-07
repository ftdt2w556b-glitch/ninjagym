import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
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
  try {
    const { amount } = await request.json();
    const val = parseInt(amount, 10);
    if (isNaN(val) || val < 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    const admin = createAdminClient();
    await Promise.all([
      admin.from("settings").upsert(
        { key: "drawer_float", value: String(val), label: "Cash Drawer Opening Float" },
        { onConflict: "key" }
      ),
      // Reset cash-removed to 0 whenever the float is updated (new day)
      admin.from("settings").upsert(
        { key: "drawer_removed", value: "0", label: "Cash Removed from Drawer Today" },
        { onConflict: "key" }
      ),
    ]);
    return NextResponse.json({ ok: true, amount: val });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

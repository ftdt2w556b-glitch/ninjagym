import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
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

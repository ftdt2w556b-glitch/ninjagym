import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { BASE_PRICES } from "@/lib/pricing";

export const revalidate = 60; // re-fetch from DB at most once per minute

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("settings")
      .select("key, value")
      .like("key", "price_%")
      .order("key");

    if (error || !data?.length) {
      // Fall back to static prices
      return NextResponse.json(BASE_PRICES);
    }

    // Build a prices record from the settings table
    const prices: Record<string, number> = { ...BASE_PRICES };
    for (const row of data) {
      const num = parseFloat(row.value);
      if (!isNaN(num)) prices[row.key] = num;
    }

    return NextResponse.json(prices);
  } catch {
    return NextResponse.json(BASE_PRICES);
  }
}

export async function PATCH(req: Request) {
  // Require admin auth via session cookie
  const { createSupabaseServerClient, createAdminClient: makeAdmin } = await import(
    "@/lib/supabase/server"
  );
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = makeAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "owner"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Record<string, number> = await req.json();

  const upserts = Object.entries(updates).map(([key, value]) => ({
    key,
    value: String(value),
    label: key
      .replace(/^price_/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  }));

  const { error } = await admin.from("settings").upsert(upserts, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

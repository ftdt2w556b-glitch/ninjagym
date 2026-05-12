import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { BASE_PRICES, MEMBERSHIP_TYPES } from "@/lib/pricing";

export const revalidate = 60;

// Default descriptions from MEMBERSHIP_TYPES
const BASE_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  MEMBERSHIP_TYPES.map((m) => [`desc_${m.id}`, m.note ?? ""])
);

// Public GET only returns price/description keys. Other settings (e.g. pos_password,
// drawer_float, drawer_removed) must NEVER be returned here — they are admin-only
// and read directly via the service-role client from server components.
const isPublicKey = (key: string) => key.startsWith("price_") || key.startsWith("desc_");

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("settings")
      .select("key, value")
      .order("key");

    if (error || !data?.length) {
      return NextResponse.json({ ...BASE_PRICES, ...BASE_DESCRIPTIONS });
    }

    const result: Record<string, string | number> = {
      ...BASE_PRICES,
      ...BASE_DESCRIPTIONS,
    };
    for (const row of data) {
      if (!isPublicKey(row.key)) continue;
      result[row.key] = row.value;
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ...BASE_PRICES, ...BASE_DESCRIPTIONS });
  }
}

export async function PATCH(req: Request) {
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
  if (!profile || !["admin", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Record<string, number | string> = await req.json();

  // Only accept the public-keyspace from this endpoint. The /admin/settings
  // UI loads its `prices` state with a `STATIC_BASE` default that includes
  // drawer_float=500 — if we accepted any key here, saving the page would
  // silently overwrite the real drawer float in the DB to 500 every time.
  // Admin-only settings (drawer_float, daycamp_end_time, *_retention_days, etc.)
  // are edited from their dedicated pages (POS screen, etc.), not this one.
  const upserts = Object.entries(updates)
    .filter(([key]) => key.startsWith("price_") || key.startsWith("desc_"))
    .map(([key, value]) => ({
      key,
      value: String(value),
      label: key
        .replace(/^(price_|desc_)/, "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    }));

  const blocked = Object.keys(updates).filter((k) => !k.startsWith("price_") && !k.startsWith("desc_"));
  if (upserts.length === 0) {
    return NextResponse.json({ ok: true, accepted: 0, blocked });
  }

  const { error } = await admin.from("settings").upsert(upserts, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, accepted: upserts.length, blocked });
}

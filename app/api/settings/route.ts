import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { BASE_PRICES, MEMBERSHIP_TYPES } from "@/lib/pricing";

export const revalidate = 60;

// Default descriptions from MEMBERSHIP_TYPES
const BASE_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  MEMBERSHIP_TYPES.map((m) => [`desc_${m.id}`, m.note ?? ""])
);

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

    // Start with all static defaults, overlay DB values
    const result: Record<string, string | number> = {
      ...BASE_PRICES,
      ...BASE_DESCRIPTIONS,
    };
    for (const row of data) {
      result[row.key] = row.value; // keep as string — page parses
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

  const upserts = Object.entries(updates).map(([key, value]) => ({
    key,
    value: String(value),
    label: key
      .replace(/^(price_|desc_)/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  }));

  const { error } = await admin.from("settings").upsert(upserts, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

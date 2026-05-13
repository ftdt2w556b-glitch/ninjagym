import { NextResponse } from "next/server";
import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/me
 * Returns the current user's role + name, or null if not signed in.
 * Used by the public birthday page to detect staff sessions and unlock
 * the cash payment option (parents online see PromptPay only).
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ role: null, name: null });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    role: profile?.role ?? null,
    name: profile?.name ?? null,
  });
}

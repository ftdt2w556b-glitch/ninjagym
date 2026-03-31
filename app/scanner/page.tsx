import { createSupabaseServerClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ScannerPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "owner", "manager", "staff"].includes(profile.role)) {
    redirect("/admin");
  }

  redirect("/admin");
}

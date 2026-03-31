import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user!.id).single();

  if (profile?.role !== "admin") redirect("/admin/dashboard");

  return <SettingsClient />;
}

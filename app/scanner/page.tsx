import { createAdminClient } from "@/lib/supabase/server";
import ScannerClient from "@/components/scanner/ScannerClient";

export default async function ScannerPage() {
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("name, email")
    .in("role", ["staff"])
    .order("name");

  const staffNames = (profiles ?? []).map(
    (p) => (p.name ?? p.email ?? "Staff") as string
  );

  return <ScannerClient staffNames={staffNames} />;
}

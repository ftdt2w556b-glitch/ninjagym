import { createAdminClient } from "@/lib/supabase/server";
import PosScreen from "@/components/admin/PosScreen";

export default async function PosPage() {
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name, email, role, pin")
    .in("role", ["admin", "staff"])
    .order("name");

  const staff = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.name ?? p.email ?? "Unknown",
    role: p.role as string,
    hasPin: !!p.pin,
  }));

  return <PosScreen staff={staff} />;
}

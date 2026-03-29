import { createAdminClient } from "@/lib/supabase/server";
import PosScreen from "@/components/admin/PosScreen";

export default async function PosPage() {
  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name, email, role, pin")
    .in("role", ["admin", "staff", "owner"])
    .order("name");

  // Fetch pos_staff separately — fails gracefully if table doesn't exist yet
  const { data: posStaff } = await admin
    .from("pos_staff")
    .select("id, name, pin_hash")
    .eq("active", true)
    .order("name");

  const staff = [
    ...(profiles ?? []).map((p) => ({
      id: p.id as string,
      name: (p.name ?? p.email ?? "Unknown") as string,
      role: p.role as string,
      hasPin: !!p.pin,
      staffType: "profile" as const,
    })),
    ...(posStaff ?? []).map((p) => ({
      id: `pos:${p.id}`,
      name: p.name as string,
      role: "pos_staff",
      hasPin: !!p.pin_hash,
      staffType: "pos" as const,
    })),
  ];

  return <PosScreen staff={staff} />;
}

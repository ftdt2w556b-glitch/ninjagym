import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import PosSimple from "@/components/admin/PosSimple";

export default async function Pos2Page() {
  const cookieStore = await cookies();
  const posAuth = cookieStore.get("pos_auth")?.value;

  const admin = createAdminClient();
  const { data: pwSetting } = await admin.from("settings").select("value").eq("key", "pos_password").maybeSingle();
  const expected = pwSetting?.value ?? process.env.POS_PASSWORD ?? null;
  const isUnlocked = expected ? posAuth === expected : posAuth === "unlocked";

  if (!isUnlocked) {
    redirect("/pos2/unlock");
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name, pin")
    .in("role", ["admin", "manager", "staff", "owner"])
    .eq("show_on_pos", true)
    .order("name");

  const { data: posStaff } = await admin
    .from("pos_staff")
    .select("id, name, pin_hash")
    .eq("active", true)
    .order("name");

  const staff = [
    ...(profiles ?? []).map((p) => ({
      id: p.id as string,
      name: (p.name ?? "Staff") as string,
      staffType: "profile" as const,
      hasPin: !!p.pin,
    })),
    ...(posStaff ?? []).map((p) => ({
      id: `pos:${p.id}`,
      name: p.name as string,
      staffType: "pos" as const,
      hasPin: !!p.pin_hash,
    })),
  ];

  // Fetch prices for walk-in session
  const { data: settings } = await admin
    .from("settings")
    .select("key, value")
    .in("key", ["price_1", "price_walkin"]);

  const priceMap: Record<string, number> = {};
  for (const s of settings ?? []) priceMap[s.key] = Number(s.value);

  return <PosSimple staff={staff} priceMap={priceMap} />;
}

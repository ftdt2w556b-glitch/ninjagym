import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import PosScreen from "@/components/admin/PosScreen";

export default async function PosKioskPage() {
  // Check kiosk cookie — no Supabase auth required
  const cookieStore = await cookies();
  const posAuth = cookieStore.get("pos_auth")?.value;

  // Check against settings table first, env var as fallback
  const admin = createAdminClient();
  const { data: pwSetting } = await admin.from("settings").select("value").eq("key", "pos_password").maybeSingle();
  const expected = pwSetting?.value ?? process.env.POS_PASSWORD ?? null;

  const isUnlocked = expected ? posAuth === expected : posAuth === "unlocked";

  if (!isUnlocked) {
    redirect("/pos/unlock");
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name, email, role, pin")
    .in("role", ["admin", "manager", "staff", "owner"])
    .eq("show_on_pos", true)
    .order("name");

  const { data: posStaff } = await admin
    .from("pos_staff")
    .select("id, name, pin_hash")
    .eq("active", true)
    .order("name");

  const { data: inventory } = await admin
    .from("shop_inventory")
    .select("item_id, variant, stock_qty");

  // Pending cash registrations — customers who self-registered and chose cash
  const { data: pendingCash } = await admin
    .from("member_registrations")
    .select("id, name, membership_type, amount_paid, kids_names, notes, created_at")
    .eq("slip_status", "cash_pending")
    .order("created_at", { ascending: true });

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

  return (
    <PosScreen
      staff={staff}
      inventory={(inventory ?? []) as { item_id: string; variant: string; stock_qty: number }[]}
      pendingCash={(pendingCash ?? []) as { id: number; name: string; membership_type: string; amount_paid: number; notes: string | null }[]}
    />
  );
}

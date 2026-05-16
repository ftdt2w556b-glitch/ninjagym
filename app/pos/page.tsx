import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import PosScreen from "@/components/admin/PosScreen";

export default async function PosKioskPage() {
  // Check kiosk cookie, no Supabase auth required
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

  // Pending cash registrations, customers who self-registered and chose cash
  const { data: pendingCashMembers } = await admin
    .from("member_registrations")
    .select("id, name, membership_type, amount_paid, kids_names, notes, created_at")
    .eq("slip_status", "cash_pending")
    .order("created_at", { ascending: true });

  // Pending cash shop orders. Parents using /shop with cash also land in
  // the POS queue so staff can ring them up and open the drawer without
  // having to walk back to /admin/payments.
  const { data: pendingCashShop } = await admin
    .from("shop_orders")
    .select("id, name, total_amount, items, notes, created_at")
    .eq("slip_status", "cash_pending")
    .order("created_at", { ascending: true });

  // Merge the two sources into the shape PosScreen already expects, with a
  // `source` discriminator so the click handler routes correctly.
  type PendingRow = {
    id:              number;
    name:            string;
    membership_type: string;
    amount_paid:     number;
    kids_names?:     string | null;
    notes:           string | null;
    created_at:      string;
    source:          "member" | "shop";
    items?:          unknown;
  };
  const pendingCash: PendingRow[] = [
    ...((pendingCashMembers ?? []).map((r) => ({
      id:              r.id as number,
      name:            (r.name as string | null) ?? "",
      membership_type: (r.membership_type as string | null) ?? "",
      amount_paid:     Number(r.amount_paid ?? 0),
      kids_names:      (r.kids_names as string | null) ?? null,
      notes:           (r.notes as string | null) ?? null,
      created_at:      r.created_at as string,
      source:          "member" as const,
    }))),
    ...((pendingCashShop ?? []).map((r) => ({
      id:              r.id as number,
      name:            (r.name as string | null) ?? "Shop order",
      membership_type: "shop",
      amount_paid:     Number(r.total_amount ?? 0),
      kids_names:      null,
      notes:           (r.notes as string | null) ?? null,
      created_at:      r.created_at as string,
      source:          "shop" as const,
      items:           r.items,
    }))),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Walk-in cash sales toggle. When true, the POS catalog (Walk-in /
  // Membership / Shop tabs) is hidden so staff can only approve pending
  // app-initiated cash transactions. Closes the underring path where
  // staff takes more cash than they ring up.
  const { data: walkinFlag } = await admin
    .from("settings")
    .select("value")
    .eq("key", "pos_walkin_disabled")
    .maybeSingle();
  const walkinDisabled = (walkinFlag?.value ?? "").toLowerCase() === "true";

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
      pendingCash={pendingCash}
      walkinDisabled={walkinDisabled}
    />
  );
}

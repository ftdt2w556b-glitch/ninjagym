import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SHOP_CATALOG } from "@/lib/shop";
import { ShopOrderItem } from "@/types";
import Badge, { slipStatusVariant, slipStatusLabel } from "@/components/ui/Badge";
import PaymentActions from "@/components/admin/PaymentActions";
import InventoryManager from "@/components/admin/InventoryManager";

// Build the full list of trackable variants from the catalog (excludes gift_card)
function buildAllVariants() {
  const rows: { item_id: string; item_name: string; variant: string; stock_qty: number }[] = [];
  for (const item of SHOP_CATALOG) {
    if (item.id === "gift_card") continue;
    const variants: string[] = [];
    if (item.options.groups) {
      for (const g of item.options.groups) variants.push(...g.values);
    } else if (item.options.values) {
      variants.push(...item.options.values);
    }
    for (const v of variants) {
      rows.push({ item_id: item.id, item_name: item.name, variant: v, stock_qty: 0 });
    }
  }
  return rows;
}

export default async function AdminShopPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  const { tab = "inventory", status } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) redirect("/admin/dashboard");

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // ── Inventory ────────────────────────────────────────────────
  const catalogVariants = buildAllVariants();
  let inventoryItems = catalogVariants;

  try {
    const { data: dbInventory } = await admin
      .from("shop_inventory")
      .select("item_id, variant, stock_qty");

    if (dbInventory) {
      inventoryItems = catalogVariants.map((cv) => {
        const db = dbInventory.find(
          (d) => d.item_id === cv.item_id && d.variant === cv.variant
        );
        return { ...cv, stock_qty: db?.stock_qty ?? 0 };
      });
    }
  } catch {
    // table may not exist yet — show 0s
  }

  // ── Orders ───────────────────────────────────────────────────
  let ordersQuery = admin
    .from("shop_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (tab === "orders") {
    if (status) ordersQuery = ordersQuery.eq("slip_status", status);
    else ordersQuery = ordersQuery.in("slip_status", ["pending_review", "cash_pending"]);
  } else {
    // inventory tab — still load pending orders count
    ordersQuery = ordersQuery.in("slip_status", ["pending_review", "cash_pending"]);
  }

  const { data: orders } = await ordersQuery;
  const pendingCount = tab === "inventory"
    ? orders?.length ?? 0
    : 0;

  // full order list for orders tab
  let allOrders = orders;
  if (tab === "orders" && status === "approved") {
    const { data } = await admin
      .from("shop_orders")
      .select("*")
      .eq("slip_status", "approved")
      .order("created_at", { ascending: false })
      .limit(50);
    allOrders = data;
  }

  const tabs = [
    { id: "inventory", label: "Stock Management" },
    { id: "orders",    label: `Orders${pendingCount > 0 ? ` (${pendingCount} pending)` : ""}` },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Shop</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <a
            key={t.id}
            href={`/admin/shop?tab=${t.id}`}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {/* ── Inventory Tab ── */}
      {tab === "inventory" && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            Track stock levels for physical items. Quantities update automatically when shop orders are approved.
          </p>
          <InventoryManager initialItems={inventoryItems} />
        </div>
      )}

      {/* ── Orders Tab ── */}
      {tab === "orders" && (
        <div>
          {/* Status filter */}
          <div className="flex gap-2 text-sm mb-5 flex-wrap">
            {[
              { value: "",         label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
            ].map((opt) => (
              <a
                key={opt.value}
                href={`/admin/shop?tab=orders${opt.value ? `&status=${opt.value}` : ""}`}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  (status ?? "") === opt.value
                    ? "bg-[#1a56db] text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {opt.label}
              </a>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            {allOrders?.map((o) => {
              const items = o.items as ShopOrderItem[];
              const slipUrl = o.slip_image
                ? `${SUPABASE_URL}/storage/v1/object/public/slips/${o.slip_image}`
                : null;

              return (
                <div key={o.id} className="bg-white rounded-2xl shadow p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900">#{o.id} · {o.name}</span>
                        <Badge
                          label={slipStatusLabel(o.slip_status)}
                          variant={slipStatusVariant(o.slip_status)}
                        />
                      </div>
                      {o.phone && <p className="text-xs text-gray-400">{o.phone}</p>}
                      {o.email && <p className="text-xs text-gray-400">{o.email}</p>}
                      <p className="text-xs text-gray-400">
                        {new Date(o.created_at).toLocaleString("en-US", { timeZone: "Asia/Bangkok", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-[#1a56db]">
                        {o.total_amount ? `฿${Number(o.total_amount).toLocaleString()}` : "–"}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">{o.payment_method}</p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="bg-gray-50 rounded-xl p-3 mb-4">
                    {items?.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm py-1">
                        <span className="text-gray-700">
                          {item.name}
                          {item.size_or_flavor && (
                            <span className="text-gray-400"> ({item.size_or_flavor})</span>
                          )}
                          <span className="text-gray-400"> ×{item.qty}</span>
                        </span>
                        <span className="font-semibold text-gray-800">
                          ฿{(item.unit_price * item.qty).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  {slipUrl && (
                    <div className="mb-4">
                      <a href={slipUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={slipUrl}
                          alt="Payment slip"
                          className="max-h-36 rounded-xl border border-gray-200 object-contain hover:opacity-90 transition-opacity"
                        />
                      </a>
                    </div>
                  )}

                  <PaymentActions
                    id={o.id}
                    recordType="shop"
                    initialStatus={o.slip_status as "pending_review" | "cash_pending" | "approved" | "rejected"}
                  />
                </div>
              );
            })}

            {(!allOrders || allOrders.length === 0) && (
              <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
                No orders found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

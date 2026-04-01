import { createAdminClient } from "@/lib/supabase/server";
import Badge, { slipStatusVariant, slipStatusLabel } from "@/components/ui/Badge";
import { ShopOrderItem } from "@/types";

export default async function ShopOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from("shop_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("slip_status", status);

  const { data: orders } = await query;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Shop Orders</h1>
        <div className="flex gap-2 text-sm flex-wrap">
          {[
            { value: "", label: "All" },
            { value: "pending_review", label: "Pending" },
            { value: "cash_pending", label: "Cash" },
            { value: "approved", label: "Done" },
          ].map((opt) => (
            <a key={opt.value}
              href={`/admin/shop-orders${opt.value ? `?status=${opt.value}` : ""}`}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                (status ?? "") === opt.value ? "bg-[#1a56db] text-white" : "text-gray-500 hover:bg-gray-100"
              }`}>
              {opt.label}
            </a>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {orders?.map((o) => {
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
                    <Badge label={slipStatusLabel(o.slip_status)} variant={slipStatusVariant(o.slip_status)} />
                  </div>
                  {o.phone && <p className="text-xs text-gray-400">{o.phone}</p>}
                  <p className="text-xs text-gray-400">
                    {new Date(o.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#1a56db]">
                    {o.total_amount ? `${Number(o.total_amount).toLocaleString()} THB` : "-"}
                  </p>
                  <p className="text-xs text-gray-400">{o.payment_method}</p>
                </div>
              </div>

              {/* Items */}
              <div className="bg-gray-50 rounded-xl p-3 mb-4">
                {items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm py-1">
                    <span className="text-gray-700">
                      {item.name}
                      {item.size_or_flavor && <span className="text-gray-400"> ({item.size_or_flavor})</span>}
                      <span className="text-gray-400"> x{item.qty}</span>
                    </span>
                    <span className="font-semibold text-gray-800">
                      {(item.unit_price * item.qty).toLocaleString()} THB
                    </span>
                  </div>
                ))}
              </div>

              {slipUrl && (
                <div className="mb-4">
                  <a href={slipUrl} target="_blank" rel="noopener noreferrer">
                    <img src={slipUrl} alt="Payment slip"
                      className="max-h-36 rounded-xl border border-gray-200 object-contain hover:opacity-90 transition-opacity" />
                  </a>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {(o.slip_status === "pending_review" || o.slip_status === "cash_pending") && (
                  <>
                    <form action="/api/payments" method="POST">
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="action" value="approve" />
                      <input type="hidden" name="type" value="shop" />
                      <button type="submit" className="bg-green-500 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-green-600 transition-colors">
                        Mark Done
                      </button>
                    </form>
                    <form action="/api/payments" method="POST">
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="action" value="reject" />
                      <input type="hidden" name="type" value="shop" />
                      <button type="submit" className="bg-red-100 text-red-600 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-red-200 transition-colors">
                        Reject
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {(!orders || orders.length === 0) && (
          <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">No orders found.</div>
        )}
      </div>
    </div>
  );
}

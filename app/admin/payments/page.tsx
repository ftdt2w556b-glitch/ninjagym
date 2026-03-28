import { createAdminClient } from "@/lib/supabase/server";
import { MEMBERSHIP_TYPES } from "@/lib/pricing";
import { ShopOrderItem } from "@/types";
import PaymentActions from "@/components/admin/PaymentActions";
import Badge, { slipStatusVariant, slipStatusLabel } from "@/components/ui/Badge";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; member?: string; source?: string }>;
}) {
  const { status, member, source = "members" } = await searchParams;
  const admin = createAdminClient();
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // ── Members query ────────────────────────────────────────────
  let membersQuery = admin
    .from("member_registrations")
    .select("id, name, phone, email, membership_type, kids_count, payment_method, amount_paid, slip_image, slip_status, slip_notes, slip_uploaded_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) membersQuery = membersQuery.eq("slip_status", status);
  else membersQuery = membersQuery.in("slip_status", ["pending_review", "cash_pending"]);
  if (member) membersQuery = membersQuery.eq("id", member);

  // ── Shop orders query ────────────────────────────────────────
  let shopQuery = admin
    .from("shop_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) shopQuery = shopQuery.eq("slip_status", status);
  else shopQuery = shopQuery.in("slip_status", ["pending_review", "cash_pending"]);

  const [{ data: members }, { data: shopOrders }] = await Promise.all([
    source === "shop" ? Promise.resolve({ data: [] }) : membersQuery,
    source === "members" ? Promise.resolve({ data: [] }) : shopQuery,
  ]);

  // pending counts for tab labels
  const { count: pendingMembers } = await admin
    .from("member_registrations")
    .select("*", { count: "exact", head: true })
    .in("slip_status", ["pending_review", "cash_pending"]);
  const { count: pendingShop } = await admin
    .from("shop_orders")
    .select("*", { count: "exact", head: true })
    .in("slip_status", ["pending_review", "cash_pending"]);

  const statusOpts = [
    { value: "",         label: "Pending"  },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Pending</h1>
      </div>

      {/* Source tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { id: "members", label: `Members${pendingMembers ? ` (${pendingMembers})` : ""}` },
          { id: "shop",    label: `Shop Orders${pendingShop ? ` (${pendingShop})` : ""}` },
        ].map((t) => (
          <a
            key={t.id}
            href={`/admin/payments?source=${t.id}`}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              source === t.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 text-sm mb-6">
        {statusOpts.map((opt) => (
          <a
            key={opt.value}
            href={`/admin/payments?source=${source}${opt.value ? `&status=${opt.value}` : ""}`}
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

      {/* ── Members list ── */}
      {source === "members" && (
        <div className="flex flex-col gap-4">
          {members?.map((m) => {
            const typeLabel = MEMBERSHIP_TYPES.find((t) => t.id === m.membership_type)?.label ?? m.membership_type;
            const slipUrl = m.slip_image
              ? `${SUPABASE_URL}/storage/v1/object/public/slips/${m.slip_image}`
              : null;

            return (
              <div key={m.id} className="bg-white rounded-2xl shadow p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900 text-base">{m.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {typeLabel} · {m.kids_count} kid{m.kids_count !== 1 ? "s" : ""}
                    </p>
                    {m.phone && <p className="text-xs text-gray-400">{m.phone}</p>}
                    {m.email && <p className="text-xs text-gray-400">{m.email}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-[#1a56db] text-lg">
                      {m.amount_paid ? `฿${Number(m.amount_paid).toLocaleString()}` : "–"}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">{m.payment_method}</p>
                    <p className="text-xs text-gray-300">
                      {new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>

                {slipUrl && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">Payment Slip:</p>
                    <a href={slipUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={slipUrl}
                        alt="Payment slip"
                        className="max-h-52 rounded-xl border border-gray-200 object-contain hover:opacity-90 transition-opacity"
                      />
                    </a>
                    {m.slip_uploaded_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Uploaded: {new Date(m.slip_uploaded_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                {!slipUrl && m.payment_method === "promptpay" && (
                  <div className="bg-yellow-50 rounded-xl px-3 py-2 mb-4 text-xs text-yellow-700">
                    ⚠️ No slip uploaded yet.
                  </div>
                )}

                {m.slip_notes && (
                  <div className="bg-gray-50 rounded-xl px-3 py-2 mb-4 text-xs text-gray-600">
                    📝 {m.slip_notes}
                  </div>
                )}

                <PaymentActions
                  id={m.id}
                  recordType="member"
                  initialStatus={m.slip_status as "pending_review" | "cash_pending" | "approved" | "rejected"}
                  qrHref={`/qr/card/${m.id}`}
                  memberName={m.name}
                />
              </div>
            );
          })}

          {(!members || members.length === 0) && (
            <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
              No member payments to review.
            </div>
          )}
        </div>
      )}

      {/* ── Shop Orders list ── */}
      {source === "shop" && (
        <div className="flex flex-col gap-4">
          {shopOrders?.map((o) => {
            const items = o.items as ShopOrderItem[];
            const slipUrl = o.slip_image
              ? `${SUPABASE_URL}/storage/v1/object/public/slips/${o.slip_image}`
              : null;

            return (
              <div key={o.id} className="bg-white rounded-2xl shadow p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">#{o.id} — {o.name}</span>
                      <Badge
                        label={slipStatusLabel(o.slip_status)}
                        variant={slipStatusVariant(o.slip_status)}
                      />
                    </div>
                    {o.phone && <p className="text-xs text-gray-400">{o.phone}</p>}
                    {o.email && <p className="text-xs text-gray-400">{o.email}</p>}
                    <p className="text-xs text-gray-400">
                      {new Date(o.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-[#1a56db]">
                      {o.total_amount ? `฿${Number(o.total_amount).toLocaleString()}` : "–"}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">{o.payment_method}</p>
                  </div>
                </div>

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

          {(!shopOrders || shopOrders.length === 0) && (
            <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
              No shop orders to review.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

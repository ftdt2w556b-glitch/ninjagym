import { createAdminClient } from "@/lib/supabase/server";
import { MEMBERSHIP_TYPES } from "@/lib/pricing";
import PaymentActions from "@/components/admin/PaymentActions";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; member?: string }>;
}) {
  const { status, member } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from("member_registrations")
    .select("id, name, phone, email, membership_type, kids_count, payment_method, amount_paid, slip_image, slip_status, slip_notes, slip_uploaded_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("slip_status", status);
  else query = query.in("slip_status", ["pending_review", "cash_pending"]);

  if (member) query = query.eq("id", member);

  const { data: members } = await query;

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Payment Review</h1>
        <div className="flex gap-2 text-sm">
          {[
            { value: "",         label: "Pending"  },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
          ].map((opt) => (
            <a
              key={opt.value}
              href={`/admin/payments${opt.value ? `?status=${opt.value}` : ""}`}
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
      </div>

      <div className="flex flex-col gap-4">
        {members?.map((m) => {
          const typeLabel = MEMBERSHIP_TYPES.find((t) => t.id === m.membership_type)?.label ?? m.membership_type;
          const slipUrl = m.slip_image
            ? `${SUPABASE_URL}/storage/v1/object/public/slips/${m.slip_image}`
            : null;

          return (
            <div key={m.id} className="bg-white rounded-2xl shadow p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-900 text-base">{m.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{typeLabel} · {m.kids_count} kid{m.kids_count !== 1 ? "s" : ""}</p>
                  {m.phone && <p className="text-xs text-gray-400">{m.phone}</p>}
                  {m.email && <p className="text-xs text-gray-400">{m.email}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-[#1a56db] text-lg">
                    {m.amount_paid ? `฿${Number(m.amount_paid).toLocaleString()}` : "-"}
                  </p>
                  <p className="text-xs text-gray-400 capitalize">{m.payment_method}</p>
                  <p className="text-xs text-gray-300">
                    {new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
              </div>

              {/* Slip image */}
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

              {/* Optimistic action buttons */}
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
            No payments to review.
          </div>
        )}
      </div>
    </div>
  );
}

import { createAdminClient } from "@/lib/supabase/server";
import Badge, { slipStatusVariant, slipStatusLabel } from "@/components/ui/Badge";
import { MEMBERSHIP_TYPES } from "@/lib/pricing";

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
            { value: "", label: "Pending" },
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
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900">{m.name}</span>
                    <Badge label={slipStatusLabel(m.slip_status)} variant={slipStatusVariant(m.slip_status)} />
                  </div>
                  <p className="text-sm text-gray-500">{typeLabel} x{m.kids_count} kids</p>
                  {m.phone && <p className="text-xs text-gray-400">{m.phone}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#1a56db]">
                    {m.amount_paid ? `${Number(m.amount_paid).toLocaleString()} THB` : "-"}
                  </p>
                  <p className="text-xs text-gray-400">{m.payment_method}</p>
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
                      className="max-h-48 rounded-xl border border-gray-200 object-contain hover:opacity-90 transition-opacity"
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
                  No slip uploaded yet.
                </div>
              )}

              {/* Notes */}
              {m.slip_notes && (
                <div className="bg-gray-50 rounded-xl px-3 py-2 mb-4 text-xs text-gray-600">
                  Note: {m.slip_notes}
                </div>
              )}

              {/* Actions */}
              {(m.slip_status === "pending_review" || m.slip_status === "cash_pending") && (
                <div className="flex gap-2 flex-wrap">
                  <form action="/api/payments" method="POST">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="action" value="approve" />
                    <input type="hidden" name="type" value="member" />
                    <button type="submit" className="bg-green-500 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-green-600 transition-colors">
                      ✓ Approve
                    </button>
                  </form>
                  <form action="/api/payments" method="POST">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="action" value="reject" />
                    <input type="hidden" name="type" value="member" />
                    <button type="submit" className="bg-red-100 text-red-600 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-red-200 transition-colors">
                      ✕ Reject
                    </button>
                  </form>
                  <a href={`/qr/card/${m.id}`} className="bg-blue-50 text-[#1a56db] font-semibold text-sm px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors">
                    View QR Card
                  </a>
                </div>
              )}
              {m.slip_status === "rejected" && (
                <form action="/api/payments" method="POST">
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="action" value="restore" />
                  <input type="hidden" name="type" value="member" />
                  <button type="submit" className="bg-yellow-100 text-yellow-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-yellow-200 transition-colors">
                    ↩ Restore to Pending
                  </button>
                </form>
              )}
              {m.slip_status === "approved" && (
                <form action="/api/payments" method="POST">
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="action" value="restore" />
                  <input type="hidden" name="type" value="member" />
                  <button type="submit" className="bg-gray-100 text-gray-500 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-gray-200 transition-colors">
                    ↩ Undo Approval
                  </button>
                </form>
              )}
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

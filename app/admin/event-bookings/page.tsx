import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Badge, { slipStatusVariant, slipStatusLabel } from "@/components/ui/Badge";
import Link from "next/link";

export default async function EventBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager", "staff", "owner"].includes(profile?.role ?? "")) redirect("/admin/dashboard");
  const canManage = ["admin", "manager", "staff", "owner"].includes(profile?.role ?? "");

  const { status } = await searchParams;

  let query = admin
    .from("event_bookings")
    .select("*")
    .order("event_date", { ascending: true })
    .limit(100);

  if (status) query = query.eq("slip_status", status);

  const { data: bookings } = await query;

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Event Bookings</h1>
        <div className="flex gap-2 text-sm flex-wrap">
          {[
            { value: "", label: "All" },
            { value: "pending_review", label: "Pending" },
            { value: "cash_pending", label: "Cash" },
            { value: "approved", label: "Approved" },
          ].map((opt) => (
            <a
              key={opt.value}
              href={`/admin/event-bookings${opt.value ? `?status=${opt.value}` : ""}`}
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
        {bookings?.map((b) => {
          const slipUrl = b.slip_image
            ? `${SUPABASE_URL}/storage/v1/object/public/slips/${b.slip_image}`
            : null;

          return (
            <div key={b.id} className="bg-white rounded-2xl shadow p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-gray-900">{b.name}</span>
                    <Badge label={slipStatusLabel(b.slip_status)} variant={slipStatusVariant(b.slip_status)} />
                  </div>
                  {b.birthday_child_name && (
                    <p className="text-sm text-gray-600">
                      Birthday: <strong>{b.birthday_child_name}</strong>
                      {b.birthday_child_age ? ` (age ${b.birthday_child_age})` : ""}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(b.event_date).toLocaleDateString("en-US", {
                      weekday: "long", year: "numeric", month: "long", day: "numeric",
                    })}
                    {" "}&mdash; <span className="capitalize">{b.time_slot}</span>
                    {b.hours ? ` (${b.hours})` : ""}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {b.num_kids} kids, {b.num_hours} hrs
                  </p>
                  {b.phone && <p className="text-xs text-gray-400">{b.phone}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#1a56db]">
                    {b.amount_paid ? `${Number(b.amount_paid).toLocaleString()} THB` : "-"}
                  </p>
                  <p className="text-xs text-gray-400">{b.payment_method}</p>
                </div>
              </div>

              {slipUrl && (
                <div className="mb-4">
                  <a href={slipUrl} target="_blank" rel="noopener noreferrer">
                    <img src={slipUrl} alt="Payment slip"
                      className="max-h-40 rounded-xl border border-gray-200 object-contain hover:opacity-90 transition-opacity" />
                  </a>
                </div>
              )}

              {b.notes && (
                <div className="bg-gray-50 rounded-xl px-3 py-2 mb-4 text-xs text-gray-600">
                  {b.notes}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {canManage && (b.slip_status === "pending_review" || b.slip_status === "cash_pending") && (
                  <>
                    <form action="/api/payments" method="POST">
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="action" value="approve" />
                      <input type="hidden" name="type" value="event" />
                      <button type="submit" className="bg-green-500 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-green-600 transition-colors">
                        Approve
                      </button>
                    </form>
                    <form action="/api/payments" method="POST">
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="action" value="reject" />
                      <input type="hidden" name="type" value="event" />
                      <button type="submit" className="bg-red-100 text-red-600 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-red-200 transition-colors">
                        Reject
                      </button>
                    </form>
                  </>
                )}
                <Link
                  href={`/admin/event-bookings/${b.id}/edit`}
                  className="bg-gray-100 text-gray-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Edit
                </Link>
              </div>
            </div>
          );
        })}

        {(!bookings || bookings.length === 0) && (
          <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
            No event bookings found.
          </div>
        )}
      </div>
    </div>
  );
}

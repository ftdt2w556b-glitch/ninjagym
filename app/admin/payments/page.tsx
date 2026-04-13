import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MEMBERSHIP_TYPES } from "@/lib/pricing";
import { ShopOrderItem } from "@/types";
import PaymentActions from "@/components/admin/PaymentActions";
import SlipUploadButton from "@/components/admin/SlipUploadButton";
import Badge, { slipStatusVariant, slipStatusLabel } from "@/components/ui/Badge";
import PendingCheckIns from "@/components/admin/PendingCheckIns";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; member?: string; source?: string; cleaned?: string }>;
}) {
  const { status, member, source = "members", cleaned } = await searchParams;

  async function cleanupTestRecords(_fd: FormData) {
    "use server";
    const supabaseInner = await createSupabaseServerClient();
    const { data: { user: caller } } = await supabaseInner.auth.getUser();
    if (!caller) redirect("/admin/payments?source=members");
    const adminClient = createAdminClient();
    const { data: callerProfile } = await adminClient
      .from("profiles").select("role").eq("id", caller.id).single();
    if (!["admin", "owner"].includes(callerProfile?.role ?? ""))
      redirect("/admin/payments?source=members");

    const { data: testRecords } = await adminClient
      .from("member_registrations")
      .select("id")
      .ilike("name", "%test%")
      .in("slip_status", ["approved", "rejected"]);

    if (testRecords && testRecords.length > 0) {
      const ids = testRecords.map((r) => r.id);
      await adminClient.from("pending_checkins").delete().in("member_id", ids);
      await adminClient.from("attendance_logs").delete().in("member_id", ids);
      await adminClient.from("member_registrations").delete().in("id", ids);
    }
    redirect("/admin/payments?source=members&cleaned=1");
  }

  const admin = createAdminClient();
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Get current user's role
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await admin.from("profiles").select("role, name").eq("id", user.id).single()
    : { data: null };
  const userRole = profile?.role ?? "staff";
  const staffName = (profile as { name?: string | null } | null)?.name ?? "Staff";

  // ── Members query (exclude birthday_event — managed via Events tab) ──
  let membersQuery = admin
    .from("member_registrations")
    .select("id, name, phone, email, membership_type, kids_count, kids_names, payment_method, amount_paid, slip_image, slip_status, slip_notes, slip_uploaded_at, created_at")
    .neq("membership_type", "birthday_event")
    .neq("payment_method", "self_register")   // auto-approved at join — no payment to review
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) membersQuery = membersQuery.eq("slip_status", status);
  else membersQuery = membersQuery.in("slip_status", ["pending_review", "cash_pending"]);
  if (member) membersQuery = membersQuery.eq("id", member);

  // ── Events query ─────────────────────────────────────────────
  let eventsQuery = admin
    .from("event_bookings")
    .select("id, name, phone, email, event_date, time_slot, hours, num_hours, num_kids, birthday_child_name, birthday_child_age, payment_method, amount_paid, slip_image, slip_status, slip_uploaded_at, notes, created_at")
    .order("event_date", { ascending: true })
    .limit(100);

  if (status) eventsQuery = eventsQuery.eq("slip_status", status);
  else eventsQuery = eventsQuery.in("slip_status", ["pending_review", "cash_pending"]);

  // ── Shop orders query ────────────────────────────────────────
  let shopQuery = admin
    .from("shop_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) shopQuery = shopQuery.eq("slip_status", status);
  else shopQuery = shopQuery.in("slip_status", ["pending_review", "cash_pending"]);

  const [{ data: members }, { data: events }, { data: shopOrders }] = await Promise.all([
    source === "members" ? membersQuery : Promise.resolve({ data: [] }),
    source === "events"  ? eventsQuery  : Promise.resolve({ data: [] }),
    source === "shop"    ? shopQuery    : Promise.resolve({ data: [] }),
  ]);

  // Build fallback kids_names map: for members missing kids_names, look up by phone
  // across all registrations so staff always see the kid's name without bouncing around
  const phonesNeedingFallback = (members ?? [])
    .filter((m) => !m.kids_names && m.phone)
    .map((m) => m.phone as string);

  const fallbackKidsNames: Record<string, string> = {};
  if (source === "members" && phonesNeedingFallback.length > 0) {
    const { data: fallbacks } = await admin
      .from("member_registrations")
      .select("phone, kids_names")
      .in("phone", phonesNeedingFallback)
      .not("kids_names", "is", null)
      .limit(200);
    for (const f of fallbacks ?? []) {
      if (f.phone && f.kids_names && !fallbackKidsNames[f.phone]) {
        fallbackKidsNames[f.phone as string] = f.kids_names as string;
      }
    }
  }

  // pending counts for tab labels
  const [{ count: pendingMembers }, { count: pendingEvents }, { count: pendingShop }] = await Promise.all([
    admin.from("member_registrations").select("*", { count: "exact", head: true })
      .neq("membership_type", "birthday_event")
      .neq("payment_method", "self_register")
      .in("slip_status", ["pending_review", "cash_pending"]),
    admin.from("event_bookings").select("*", { count: "exact", head: true })
      .in("slip_status", ["pending_review", "cash_pending"]),
    admin.from("shop_orders").select("*", { count: "exact", head: true })
      .in("slip_status", ["pending_review", "cash_pending"]),
  ]);

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

      {/* Parent-initiated check-in requests */}
      <PendingCheckIns staffName={staffName} />

      {cleaned === "1" && (
        <div className="bg-green-50 text-green-700 text-sm rounded-xl px-4 py-3 mb-4 font-semibold">
          ✓ TEST records deleted.
        </div>
      )}

      {/* Source tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { id: "members", label: `Members${pendingMembers ? ` (${pendingMembers})` : ""}` },
          { id: "events",  label: `Events${pendingEvents ? ` (${pendingEvents})` : ""}` },
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
          {["admin", "owner"].includes(userRole) && (
            <form action={cleanupTestRecords} className="self-end">
              <button
                type="submit"
                className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-300 rounded-lg px-3 py-1.5 transition-colors"
              >
                🗑 Delete all TEST records
              </button>
            </form>
          )}
          {members?.map((m) => {
            const typeLabel = MEMBERSHIP_TYPES.find((t) => t.id === m.membership_type)?.label ?? m.membership_type;
            const slipUrl = m.slip_image
              ? `${SUPABASE_URL}/storage/v1/object/public/slips/${m.slip_image}`
              : null;
            const fallbackName = !m.kids_names && m.phone ? fallbackKidsNames[m.phone] : null;

            return (
              <div key={m.id} className="bg-white rounded-2xl shadow p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900 text-base">{m.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {typeLabel} · {m.kids_count} kid{m.kids_count !== 1 ? "s" : ""}
                    </p>
                    {m.kids_names
                      ? <p className="text-sm font-bold text-[#1a56db] mt-0.5">👦 {m.kids_names}</p>
                      : fallbackName
                        ? <p className="text-sm font-semibold text-gray-500 mt-0.5">👦 {fallbackName} <span className="text-xs font-normal text-gray-400">(from member card)</span></p>
                        : <p className="text-xs text-red-400 italic mt-0.5">⚠️ No kid name provided</p>
                    }
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
                        Uploaded: {new Date(m.slip_uploaded_at).toLocaleString("en-US", { timeZone: "Asia/Bangkok", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                      </p>
                    )}
                  </div>
                )}

                {!slipUrl && m.payment_method === "promptpay" && (
                  <div className="bg-yellow-50 rounded-xl px-3 py-2 mb-4 flex items-center gap-3">
                    <span className="text-xs text-yellow-700">⚠️ No slip uploaded yet.</span>
                    <SlipUploadButton memberId={m.id} />
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
                  qrHref={`/qr/card/${m.id}?from=admin`}
                  memberName={m.name}
                  userRole={userRole}
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

      {/* ── Events list ── */}
      {source === "events" && (
        <div className="flex flex-col gap-4">
          {events?.map((b) => {
            const slipUrl = b.slip_image
              ? `${SUPABASE_URL}/storage/v1/object/public/slips/${b.slip_image}`
              : null;

            return (
              <div key={b.id} className="bg-white rounded-2xl shadow p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900 text-base">{b.name}</p>
                    <p className="text-sm text-[#1a56db] font-semibold mt-0.5">
                      🎂 {b.birthday_child_name}
                      {b.birthday_child_age ? `, turning ${b.birthday_child_age}` : ""}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {b.event_date
                        ? new Date(b.event_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                        : ""}
                      {b.time_slot ? ` · ${b.time_slot}` : ""}
                      {b.num_hours ? ` · ${b.num_hours}h` : ""}
                      {b.num_kids ? ` · ${b.num_kids} kids` : ""}
                    </p>
                    {b.phone && <p className="text-xs text-gray-400">{b.phone}</p>}
                    {b.email && <p className="text-xs text-gray-400">{b.email}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-[#1a56db] text-lg">
                      {b.amount_paid ? `฿${Number(b.amount_paid).toLocaleString()}` : "–"}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">{b.payment_method}</p>
                    <p className="text-xs text-gray-300">
                      {new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>

                {b.notes && (
                  <div className="bg-gray-50 rounded-xl px-3 py-2 mb-4 text-xs text-gray-600">
                    📝 {b.notes}
                  </div>
                )}

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
                    {b.slip_uploaded_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Uploaded: {new Date(b.slip_uploaded_at).toLocaleString("en-US", { timeZone: "Asia/Bangkok", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                      </p>
                    )}
                  </div>
                )}

                {!slipUrl && b.payment_method === "promptpay" && (
                  <div className="bg-yellow-50 rounded-xl px-3 py-2 mb-4 text-xs text-yellow-700">
                    ⚠️ No slip uploaded yet.
                  </div>
                )}

                <PaymentActions
                  id={b.id}
                  recordType="event"
                  initialStatus={b.slip_status as "pending_review" | "cash_pending" | "approved" | "rejected"}
                  userRole={userRole}
                />
              </div>
            );
          })}

          {(!events || events.length === 0) && (
            <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
              No event bookings to review.
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
                  userRole={userRole}
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

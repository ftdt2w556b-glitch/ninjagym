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
  searchParams: Promise<{ status?: string; member?: string; source?: string; cleaned?: string; q?: string; range?: string }>;
}) {
  const { status, member, source = "members", cleaned, q, range = "today" } = await searchParams;

  // Date range for the Approved-tab subsections (Belt Perks + Check-Ins Approved).
  // Matches the period concept on the Check-ins tab. Default: today.
  const approvedRange: "today" | "week" | "month" | "all" =
    range === "week" || range === "month" || range === "all" ? range : "today";
  const rangeStartIso = (() => {
    const now = new Date();
    const bkk = new Date(now.getTime() + 7 * 3_600_000);
    bkk.setUTCHours(0, 0, 0, 0);
    if (approvedRange === "today") {
      return new Date(bkk.getTime() - 7 * 3_600_000).toISOString();
    }
    if (approvedRange === "week") {
      // Last 7 days inclusive of today (Bangkok)
      bkk.setUTCDate(bkk.getUTCDate() - 6);
      return new Date(bkk.getTime() - 7 * 3_600_000).toISOString();
    }
    if (approvedRange === "month") {
      // First day of the current Bangkok month
      bkk.setUTCDate(1);
      return new Date(bkk.getTime() - 7 * 3_600_000).toISOString();
    }
    return null; // "all" — no lower bound
  })();

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
    .select("id, name, phone, email, membership_type, kids_count, kids_names, payment_method, amount_paid, slip_image, slip_hash, slip_status, slip_notes, slip_uploaded_at, created_at")
    .neq("membership_type", "birthday_event")
    .neq("payment_method", "self_register");  // auto-approved at join — no payment to review

  if (status) {
    // Approved/Rejected: sort by slip_reviewed_at so today's check-ins always appear at top
    membersQuery = membersQuery
      .eq("slip_status", status)
      .order("slip_reviewed_at", { ascending: false, nullsFirst: false })
      .limit(500);
  } else {
    membersQuery = membersQuery
      .in("slip_status", ["pending_review", "cash_pending"])
      // PromptPay pending_review is already shown as the orange check-in card (pending_checkins).
      // Hide it here to avoid the duplicate white card confusing staff.
      // It reappears correctly in the Approved / Rejected history views.
      .neq("payment_method", "promptpay")
      .order("created_at", { ascending: false })
      .limit(100);
  }
  if (member) membersQuery = membersQuery.eq("id", member);
  if (q) membersQuery = membersQuery.ilike("name", `%${q}%`);

  // ── Events query ─────────────────────────────────────────────
  let eventsQuery = admin
    .from("event_bookings")
    .select("id, name, phone, email, event_date, time_slot, hours, num_hours, num_kids, birthday_child_name, birthday_child_age, payment_method, amount_paid, slip_image, slip_hash, slip_status, slip_uploaded_at, notes, created_at")
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

  // ── Approved belt perks ─────────────────────────────────────
  // Perks live in pending_checkins (status=approved, type LIKE 'belt_perk_%').
  // They have no slip / amount, so we surface them as their own subsection on
  // the Approved Members tab so staff have a visible record of redemptions.
  const showPerks = source === "members" && status === "approved";
  let perksQuery = admin
    .from("pending_checkins")
    .select("id, member_id, member_name, kids_count, kids_names, membership_type, membership_label, handled_at, handled_by, requested_at")
    .eq("status", "approved")
    .like("membership_type", "belt_perk_%")
    .order("handled_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (q) perksQuery = perksQuery.ilike("member_name", `%${q}%`);
  if (rangeStartIso) perksQuery = perksQuery.gte("handled_at", rangeStartIso);

  // Today's approved session-use check-ins (parent tapped "Use a Session" and
  // staff approved). These don't create member_registrations rows so the regular
  // Approved list misses them. Surfaced here so "everything approved today" is
  // visible on one page. Belt perks go in their own section above this one.
  const showCheckIns = source === "members" && status === "approved";
  let checkInsQuery = admin
    .from("pending_checkins")
    .select("id, member_id, member_name, kids_count, kids_names, membership_type, membership_label, handled_at, handled_by, requested_at, payment_method")
    .eq("status", "approved")
    .not("membership_type", "like", "belt_perk_%")
    .order("handled_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (q) checkInsQuery = checkInsQuery.ilike("member_name", `%${q}%`);
  if (rangeStartIso) checkInsQuery = checkInsQuery.gte("handled_at", rangeStartIso);

  const [{ data: members }, { data: events }, { data: shopOrders }, { data: perks }, { data: approvedCheckIns }] = await Promise.all([
    source === "members" ? membersQuery   : Promise.resolve({ data: [] }),
    source === "events"  ? eventsQuery    : Promise.resolve({ data: [] }),
    source === "shop"    ? shopQuery      : Promise.resolve({ data: [] }),
    showPerks            ? perksQuery     : Promise.resolve({ data: [] }),
    showCheckIns         ? checkInsQuery  : Promise.resolve({ data: [] }),
  ]);

  // ── Duplicate-slip detection ─────────────────────────────────────
  // Count every slip_hash across all three tables. Anything seen more than once
  // gets an amber "duplicate" badge on the staff review card so staff don't
  // rubber-stamp a re-used payment slip. Hashing is exact-byte; near-duplicates
  // (different screenshot of the same payment) won't be caught here.
  const duplicateHashes = new Set<string>();
  {
    const [m, e, s] = await Promise.all([
      admin.from("member_registrations").select("slip_hash").not("slip_hash", "is", null),
      admin.from("event_bookings").select("slip_hash").not("slip_hash", "is", null),
      admin.from("shop_orders").select("slip_hash").not("slip_hash", "is", null),
    ]);
    const counts = new Map<string, number>();
    for (const r of [...(m.data ?? []), ...(e.data ?? []), ...(s.data ?? [])]) {
      const h = (r.slip_hash as string | null) ?? null;
      if (!h) continue;
      counts.set(h, (counts.get(h) ?? 0) + 1);
    }
    for (const [h, n] of counts) if (n > 1) duplicateHashes.add(h);
  }

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
      .neq("payment_method", "promptpay")
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
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex gap-2 text-sm">
          {statusOpts.map((opt) => (
            <a
              key={opt.value}
              href={`/admin/payments?source=${source}${opt.value ? `&status=${opt.value}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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
        {/* Name search — useful for finding old approved/rejected records */}
        <form method="GET" className="flex items-center gap-1 ml-auto">
          <input type="hidden" name="source" value={source} />
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name…"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-1 focus:ring-[#1a56db]"
          />
          <button type="submit"
            className="text-sm bg-[#1a56db] text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
            Search
          </button>
          {q && (
            <a href={`/admin/payments?source=${source}${status ? `&status=${status}` : ""}`}
              className="text-xs text-gray-400 hover:text-gray-600 px-1">✕</a>
          )}
        </form>
      </div>

      {/* ── Members list ── */}
      {source === "members" && (
        <div className="flex flex-col gap-4">
          {/* Range filter — only on Approved tab, applies to both Belt Perks and Check-Ins subsections */}
          {status === "approved" && (
            <div className="flex items-center gap-2 self-end -mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Show approved:</span>
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {([
                  { id: "today", label: "Today" },
                  { id: "week",  label: "Week"  },
                  { id: "month", label: "Month" },
                  { id: "all",   label: "All"   },
                ] as const).map((r) => (
                  <a
                    key={r.id}
                    href={`/admin/payments?source=members&status=approved&range=${r.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      approvedRange === r.id
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {r.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Approved belt perks (only on Approved tab) */}
          {showPerks && (perks?.length ?? 0) > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🥋</span>
                <h2 className="font-bold text-amber-900 text-sm">
                  Belt Perks Approved
                  {approvedRange === "today" ? " — Today" :
                   approvedRange === "week"  ? " — This Week" :
                   approvedRange === "month" ? " — This Month" : ""}
                </h2>
                <span className="text-xs text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 font-semibold">
                  {perks?.length ?? 0}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {perks?.map((p) => {
                  const handledAt = p.handled_at ? new Date(p.handled_at as string) : null;
                  const handledStr = handledAt
                    ? handledAt.toLocaleString("en-US", { timeZone: "Asia/Bangkok", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
                    : "—";
                  return (
                    <div key={p.id} className="bg-white rounded-xl px-4 py-3 flex items-start justify-between gap-3 border border-amber-100">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{p.member_name}</p>
                        <p className="text-xs text-amber-800 font-semibold mt-0.5">
                          {(p.membership_label as string | null) ?? (p.membership_type as string)}
                        </p>
                        {p.kids_names && (
                          <p className="text-xs font-semibold text-[#1a56db] mt-0.5">👦 {p.kids_names as string}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-500">{handledStr}</p>
                        {p.handled_by && (
                          <p className="text-xs text-gray-400">by {p.handled_by as string}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Today's approved session-use check-ins (only on Approved tab) */}
          {showCheckIns && (approvedCheckIns?.length ?? 0) > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">✅</span>
                <h2 className="font-bold text-emerald-900 text-sm">
                  Check-Ins Approved
                  {approvedRange === "today" ? " — Today" :
                   approvedRange === "week"  ? " — This Week" :
                   approvedRange === "month" ? " — This Month" :
                                                " — All"}
                </h2>
                <span className="text-xs text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5 font-semibold">
                  {approvedCheckIns?.length ?? 0}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {approvedCheckIns?.map((c) => {
                  const handledAt = c.handled_at ? new Date(c.handled_at as string) : null;
                  const handledStr = handledAt
                    ? handledAt.toLocaleString("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", minute: "2-digit", hour12: true })
                    : "—";
                  const isPayment = !!c.payment_method;
                  return (
                    <div key={c.id} className="bg-white rounded-xl px-4 py-3 flex items-start justify-between gap-3 border border-emerald-100">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{c.member_name}</p>
                        <p className="text-xs text-emerald-800 font-semibold mt-0.5">
                          {(c.membership_label as string | null) ?? (c.membership_type as string)}
                          {c.kids_count ? ` · ${c.kids_count} kid${c.kids_count !== 1 ? "s" : ""}` : ""}
                        </p>
                        {c.kids_names && (
                          <p className="text-xs font-semibold text-[#1a56db] mt-0.5">👦 {c.kids_names as string}</p>
                        )}
                        {isPayment && (
                          <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">PromptPay payment + check-in</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-500">{handledStr}</p>
                        {c.handled_by && (
                          <p className="text-xs text-gray-400">by {c.handled_by as string}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
            const slipHash    = (m as { slip_hash?: string | null }).slip_hash ?? null;
            const isDupeSlip  = slipHash ? duplicateHashes.has(slipHash) : false;

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
                    {isDupeSlip && (
                      <div className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 rounded-full px-3 py-1">
                        ⚠️ Duplicate slip — this image was uploaded on another record. Verify before approving.
                      </div>
                    )}
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
            const slipHash   = (b as { slip_hash?: string | null }).slip_hash ?? null;
            const isDupeSlip = slipHash ? duplicateHashes.has(slipHash) : false;

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
                    {isDupeSlip && (
                      <div className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 rounded-full px-3 py-1">
                        ⚠️ Duplicate slip — this image was uploaded on another record. Verify before approving.
                      </div>
                    )}
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
            const slipHash   = (o as { slip_hash?: string | null }).slip_hash ?? null;
            const isDupeSlip = slipHash ? duplicateHashes.has(slipHash) : false;

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
                    {isDupeSlip && (
                      <div className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 rounded-full px-3 py-1">
                        ⚠️ Duplicate slip — this image was uploaded on another record. Verify before approving.
                      </div>
                    )}
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

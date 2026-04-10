import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { bangkokToday, bangkokStartOfDay, bangkokEndOfDay } from "@/lib/timezone";
import { redirect } from "next/navigation";

async function savePosPassword(formData: FormData) {
  "use server";
  const newPassword = (formData.get("password") as string)?.trim();
  if (!newPassword || newPassword.length < 4) redirect("/admin/pos?error=short");

  const { createAdminClient: makeAdmin, createSupabaseServerClient: makeClient } = await import("@/lib/supabase/server");
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = makeAdmin();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "manager"].includes(profile.role)) redirect("/admin/pos");

  await admin.from("settings").upsert(
    { key: "pos_password", value: newPassword, label: "POS Kiosk Password" },
    { onConflict: "key" }
  );
  redirect("/admin/pos?saved=1");
}

async function saveDrawerFloat(formData: FormData) {
  "use server";
  const raw = (formData.get("float") as string)?.trim();
  const val = parseInt(raw, 10);
  if (isNaN(val) || val < 0) redirect("/admin/pos?floaterror=1");

  const { createAdminClient: makeAdmin, createSupabaseServerClient: makeClient } = await import("@/lib/supabase/server");
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = makeAdmin();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "manager"].includes(profile.role)) redirect("/admin/pos");

  await admin.from("settings").upsert(
    { key: "drawer_float", value: String(val), label: "Cash Drawer Opening Float" },
    { onConflict: "key" }
  );
  // Reset cash-removed and manual expected whenever float is updated (new day / new count)
  await admin.from("settings").upsert(
    { key: "drawer_removed", value: "0", label: "Cash Removed from Drawer Today" },
    { onConflict: "key" }
  );
  await admin.from("settings").upsert(
    { key: "drawer_expected", value: "", label: "Expected in Drawer (manual override)" },
    { onConflict: "key" }
  );
  redirect("/admin/pos?floatsaved=1");
}

async function saveDrawerExpected(formData: FormData) {
  "use server";
  const raw = (formData.get("expected") as string)?.trim();
  const val = parseInt(raw, 10);
  if (isNaN(val) || val < 0) redirect("/admin/pos?expectederr=1");

  const { createAdminClient: makeAdmin, createSupabaseServerClient: makeClient } = await import("@/lib/supabase/server");
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = makeAdmin();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "manager"].includes(profile.role)) redirect("/admin/pos");

  await admin.from("settings").upsert(
    { key: "drawer_expected", value: String(val), label: "Expected in Drawer (manual override)" },
    { onConflict: "key" }
  );
  redirect("/admin/pos?expectedsaved=1");
}

async function clearDrawerExpected() {
  "use server";
  const { createAdminClient: makeAdmin, createSupabaseServerClient: makeClient } = await import("@/lib/supabase/server");
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const admin = makeAdmin();
  await admin.from("settings").upsert(
    { key: "drawer_expected", value: "", label: "Expected in Drawer (manual override)" },
    { onConflict: "key" }
  );
  redirect("/admin/pos");
}

async function saveDrawerRemoved(formData: FormData) {
  "use server";
  const raw = (formData.get("removed") as string)?.trim();
  const val = parseInt(raw, 10);
  if (isNaN(val) || val < 0) redirect("/admin/pos?removederr=1");

  const { createAdminClient: makeAdmin, createSupabaseServerClient: makeClient } = await import("@/lib/supabase/server");
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = makeAdmin();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "manager"].includes(profile.role)) redirect("/admin/pos");

  await admin.from("settings").upsert(
    { key: "drawer_removed", value: String(val), label: "Cash Removed from Drawer Today" },
    { onConflict: "key" }
  );
  redirect("/admin/pos?removedsaved=1");
}

export default async function AdminPosPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; floatsaved?: string; floaterror?: string; removedsaved?: string; removederr?: string; expectedsaved?: string; expectederr?: string }>;
}) {
  const params = await searchParams;
  const admin = createAdminClient();
  const supabase = await createSupabaseServerClient();

  // Admin/manager only
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user!.id).single();
  if (!profile || !["admin", "manager"].includes(profile.role)) redirect("/admin/dashboard");

  // Current POS password (settings table → env var fallback)
  const { data: pwSetting } = await admin.from("settings").select("value").eq("key", "pos_password").maybeSingle();
  const currentPassword = pwSetting?.value ?? process.env.POS_PASSWORD ?? "(not set)";

  // Opening float + cash removed
  const { data: floatSetting } = await admin.from("settings").select("value").eq("key", "drawer_float").maybeSingle();
  const currentFloat = floatSetting?.value ? parseInt(floatSetting.value, 10) : 500;

  const { data: removedSetting } = await admin.from("settings").select("value").eq("key", "drawer_removed").maybeSingle();
  const currentRemoved = removedSetting?.value ? parseInt(removedSetting.value, 10) : 0;

  const { data: expectedSetting } = await admin.from("settings").select("value").eq("key", "drawer_expected").maybeSingle();
  const manualExpected = expectedSetting?.value ? parseInt(expectedSetting.value, 10) : null;

  // Recent POS activity — last 20 cash sales
  const { data: recentSales } = await admin
    .from("cash_sales")
    .select("id, processed_at, amount, amount_tendered, change_given, sale_type, staff_name, notes, items")
    .order("processed_at", { ascending: false })
    .limit(20);

  // Today's cash by staff (Bangkok time)
  const today = bangkokToday();
  // ALL cash sales today — used for drawer calculations (no membership exclusion here;
  // double-count prevention is only needed on the cash report page, not here)
  const { data: todaySales } = await admin
    .from("cash_sales")
    .select("amount, staff_name")
    .gte("processed_at", bangkokStartOfDay())
    .lte("processed_at", bangkokEndOfDay());

  // Box total + change given from all cash sales today
  let todayBoxTotal = 0;
  let todayChangeTotal = 0;
  const { data: todayNotes1kRows } = await admin
    .from("cash_sales")
    .select("notes_1k, change_given")
    .gte("processed_at", bangkokStartOfDay())
    .lte("processed_at", bangkokEndOfDay());
  if (todayNotes1kRows) {
    for (const r of todayNotes1kRows) {
      const row = r as Record<string, unknown>;
      todayBoxTotal    += Number(row.notes_1k ?? 0) * 1000;
      todayChangeTotal += Number(row.change_given ?? 0);
    }
  }

  const staffMap = new Map<string, { total: number; count: number }>();
  for (const s of todaySales ?? []) {
    const key = s.staff_name ?? "⚠️ Unattributed";
    const prev = staffMap.get(key) ?? { total: 0, count: 0 };
    staffMap.set(key, { total: prev.total + Number(s.amount), count: prev.count + 1 });
  }
  const staffBreakdown = [...staffMap.entries()].sort((a, b) => b[1].total - a[1].total);
  const todayTotal = (todaySales ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const hasUnattributed = staffMap.has("⚠️ Unattributed");

  const posUrl = "https://ninjagym.com/pos";

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900">POS Register</h1>

      {/* POS URL */}
      <div className="bg-white rounded-2xl shadow p-5">
        <h2 className="font-bold text-gray-800 mb-3">Register Tablet URL</h2>
        <div className="flex items-center gap-3">
          <code className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#1a56db] font-mono">
            {posUrl}
          </code>
          <a
            href={posUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#1a56db] text-white font-bold text-sm px-4 py-3 rounded-xl hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            Open POS →
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Bookmark this on the register tablet. No login required. Just enter the kiosk password below.
        </p>
      </div>

      {/* POS Password */}
      <div className="bg-white rounded-2xl shadow p-5">
        <h2 className="font-bold text-gray-800 mb-1">Kiosk Password</h2>
        <p className="text-sm text-gray-500 mb-4">
          Enter this once on the register tablet. It stays unlocked until changed.
        </p>

        {params.saved === "1" && (
          <div className="bg-green-50 text-green-700 text-sm rounded-xl px-4 py-2 mb-4 font-semibold">
            ✓ Password updated. Re-enter it on the tablet to unlock.
          </div>
        )}
        {params.error === "short" && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-2 mb-4">
            Password must be at least 4 characters.
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-mono text-gray-800 tracking-widest">
            {currentPassword}
          </div>
        </div>

        <form action={savePosPassword} className="flex gap-3">
          <input
            type="text"
            name="password"
            placeholder="New password"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
          />
          <button
            type="submit"
            className="bg-gray-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-colors whitespace-nowrap"
          >
            Change Password
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-2">
          After changing, the tablet will need to unlock again with the new password.
        </p>
      </div>

      {/* Starting Amount */}
      <div className="bg-white rounded-2xl shadow p-5">
        <h2 className="font-bold text-gray-800 mb-1">Drawer Starting Amount</h2>
        <p className="text-sm text-gray-500 mb-4">
          The cash counted in the drawer at the start of the day. Used to calculate the expected balance on the POS.
        </p>

        {params.floatsaved === "1" && (
          <div className="bg-green-50 text-green-700 text-sm rounded-xl px-4 py-2 mb-4 font-semibold">
            ✓ Starting amount updated.
          </div>
        )}
        {params.floaterror === "1" && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-2 mb-4">
            Please enter a valid amount (0 or more).
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-mono text-gray-800">
            ฿{currentFloat.toLocaleString()}
          </div>
          <span className="text-sm text-gray-400">current starting amount</span>
        </div>

        <form action={saveDrawerFloat} className="flex gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">฿</span>
            <input
              type="number"
              name="float"
              min="0"
              step="1"
              placeholder="e.g. 5000"
              className="pl-7 border border-gray-200 rounded-xl px-3 py-2.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            />
          </div>
          <button
            type="submit"
            className="bg-gray-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-colors whitespace-nowrap"
          >
            Update Start
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-2">
          Also editable directly on the POS screen (admin/manager only).
        </p>

        {/* Today's drawer tally — always shown so Expected in Drawer is visible at day start */}
        <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Today&apos;s Drawer Check</p>
            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-0.5">Opening Float</p>
                <p className="font-bold text-gray-800">฿{currentFloat.toLocaleString()}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-0.5">Collected Today</p>
                <p className="font-bold text-green-700">฿{todayTotal.toLocaleString()}</p>
              </div>
              {todayBoxTotal > 0 && (
                <div className="bg-yellow-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-0.5">In Box (1K notes)</p>
                  <p className="font-bold text-yellow-700">฿{todayBoxTotal.toLocaleString()}</p>
                </div>
              )}
              {todayChangeTotal > 0 && (
                <div className="bg-orange-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-0.5">Change Given</p>
                  <p className="font-bold text-orange-600">-฿{todayChangeTotal.toLocaleString()}</p>
                  <p className="text-gray-400 text-xs mt-0.5">Already in amounts ↑</p>
                </div>
              )}
              {currentRemoved > 0 && (
                <div className="bg-red-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-0.5">Removed from Drawer</p>
                  <p className="font-bold text-red-600">-฿{currentRemoved.toLocaleString()}</p>
                </div>
              )}
              <div className="bg-blue-50 rounded-xl p-3 col-span-2">
                <p className="text-gray-400 text-xs mb-0.5">Expected in Drawer</p>
                <p className="font-bold text-blue-700 text-xl">
                  ฿{(manualExpected ?? (currentFloat + todayTotal - todayBoxTotal - currentRemoved)).toLocaleString()}
                  {manualExpected !== null && (
                    <span className="text-xs text-gray-400 font-normal ml-2">
                      (manual · calc: ฿{(currentFloat + todayTotal - todayBoxTotal - currentRemoved).toLocaleString()})
                    </span>
                  )}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Float ฿{currentFloat.toLocaleString()} + Collected ฿{todayTotal.toLocaleString()}
              {todayBoxTotal > 0 ? ` - Box ฿${todayBoxTotal.toLocaleString()}` : ""}
              {currentRemoved > 0 ? ` - Removed ฿${currentRemoved.toLocaleString()}` : ""}
              {" = "}<strong>฿{(currentFloat + todayTotal - todayBoxTotal - currentRemoved).toLocaleString()}</strong> expected in drawer
            </p>
            {/* Manual override for expected */}
            {params.expectedsaved === "1" && (
              <div className="bg-green-50 text-green-700 text-sm rounded-xl px-4 py-2 mb-3 font-semibold">
                ✓ Expected amount updated.
              </div>
            )}
            {params.expectederr === "1" && (
              <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-2 mb-3">
                Please enter a valid amount (0 or more).
              </div>
            )}
            <form action={saveDrawerExpected} className="flex gap-3 items-center">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">฿</span>
                <input
                  type="number"
                  name="expected"
                  min="0"
                  step="1"
                  defaultValue={manualExpected ?? (currentFloat + todayTotal - todayBoxTotal - currentRemoved)}
                  className="pl-7 border border-gray-200 rounded-xl px-3 py-2.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
                />
              </div>
              <button
                type="submit"
                className="bg-blue-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                Set Expected
              </button>
              <span className="text-xs text-gray-400">Override the calculated amount</span>
            </form>
            {manualExpected !== null && (
              <form action={clearDrawerExpected}>
                <button type="submit" className="text-xs text-gray-400 underline hover:text-gray-600">
                  Clear override → use calculated
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Cash removed from drawer */}
        <div className="mt-5 pt-5 border-t border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 mb-1">Cash Removed from Drawer</h3>
          <p className="text-xs text-gray-400 mb-3">
            Record cash physically taken out of the drawer (safe drop, petty cash, etc). Resets automatically when you update the Starting Amount.
          </p>
          {params.removedsaved === "1" && (
            <div className="bg-green-50 text-green-700 text-sm rounded-xl px-4 py-2 mb-3 font-semibold">
              ✓ Removal amount updated.
            </div>
          )}
          {params.removederr === "1" && (
            <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-2 mb-3">
              Please enter a valid amount (0 or more).
            </div>
          )}
          <form action={saveDrawerRemoved} className="flex gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">฿</span>
              <input
                type="number"
                name="removed"
                min="0"
                step="1"
                defaultValue={currentRemoved > 0 ? currentRemoved : undefined}
                placeholder={currentRemoved > 0 ? String(currentRemoved) : "0"}
                className="pl-7 border border-gray-200 rounded-xl px-3 py-2.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
              />
            </div>
            <button
              type="submit"
              className="bg-gray-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-colors whitespace-nowrap"
            >
              Update Removed
            </button>
          </form>
        </div>
      </div>

      {/* Today's cash by staff */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-800">Today&apos;s Cash by Staff</h2>
            <p className="text-xs text-gray-400 mt-0.5">Cross-check against physical drawer at end of shift</p>
          </div>
          {hasUnattributed && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">⚠️ Unattributed cash</span>
          )}
        </div>
        {staffBreakdown.length === 0 ? (
          <p className="px-5 py-5 text-gray-400 text-sm">No cash sales recorded today.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {staffBreakdown.map(([name, { total, count }]) => {
              const isUnattributed = name === "⚠️ Unattributed";
              const pct = todayTotal > 0 ? (total / todayTotal) * 100 : 0;
              return (
                <div key={name} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-semibold text-sm ${isUnattributed ? "text-red-600" : "text-gray-800"}`}>{name}</span>
                      <span className="text-xs text-gray-400">{count} payment{count !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${isUnattributed ? "bg-red-400" : "bg-green-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className={`font-bold text-lg tabular-nums ${isUnattributed ? "text-red-600" : "text-gray-900"}`}>
                    ฿{total.toLocaleString()}
                  </span>
                </div>
              );
            })}
            <div className="px-5 py-3 flex items-center justify-between bg-gray-50">
              <span className="text-sm font-semibold text-gray-600">Total cash collected today</span>
              <span className="font-bold text-lg text-gray-900">฿{todayTotal.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Recent POS sales */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Recent POS Sales</h2>
          <a href="/admin/pos/archive" className="text-xs text-[#1a56db] hover:underline">View archive →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs">#</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs">Time</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs">Staff</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs">Member / Type</th>
                <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs">Amount</th>
                <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs">Cash Paid / Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(recentSales ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No POS sales yet.</td></tr>
              )}
              {(recentSales ?? []).map((s) => {
                const dt = new Date(s.processed_at as string);
                const dateStr = dt.toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok", day: "2-digit", month: "short" });
                const timeStr = dt.toLocaleTimeString("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", minute: "2-digit", hour12: true });
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 text-xs">#{s.id}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{dateStr} {timeStr}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{s.staff_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        // Derive types from items array if available, else fall back to sale_type
                        const itemsArr = Array.isArray(s.items) ? s.items as { type?: string; category?: string }[] : null;
                        const types = itemsArr
                          ? [...new Set(itemsArr.map((i) => i.type ?? i.category ?? s.sale_type).filter(Boolean))]
                          : [s.sale_type].filter(Boolean);
                        const colorMap: Record<string, string> = {
                          membership: "bg-blue-100 text-blue-700",
                          shop: "bg-purple-100 text-purple-700",
                          event: "bg-orange-100 text-orange-700",
                          walkin: "bg-gray-100 text-gray-600",
                        };
                        return (
                          <div>
                            {s.notes && (
                              <p className="text-gray-800 font-medium text-xs mb-1">{s.notes as string}</p>
                            )}
                            <div className="flex flex-wrap gap-1">
                              {types.map((t) => (
                                <span key={t} className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${colorMap[t as string] ?? "bg-gray-100 text-gray-600"}`}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{Number(s.amount).toLocaleString()} THB</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {(s as Record<string, unknown>).amount_tendered != null && (
                        <p className="text-gray-500 text-xs">paid ฿{Number((s as Record<string, unknown>).amount_tendered).toLocaleString()}</p>
                      )}
                      {(s as Record<string, unknown>).change_given != null ? (
                        <span className="text-orange-600 font-semibold">฿{Number((s as Record<string, unknown>).change_given).toLocaleString()} change</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

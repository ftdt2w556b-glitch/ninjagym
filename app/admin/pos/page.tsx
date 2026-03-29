import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
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
  if (!profile || !["admin", "owner"].includes(profile.role)) redirect("/admin/pos");

  await admin.from("settings").upsert(
    { key: "pos_password", value: newPassword, label: "POS Kiosk Password" },
    { onConflict: "key" }
  );
  redirect("/admin/pos?saved=1");
}

export default async function AdminPosPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const admin = createAdminClient();
  const supabase = await createSupabaseServerClient();

  // Admin/owner only
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user!.id).single();
  if (!profile || !["admin", "owner"].includes(profile.role)) redirect("/admin/dashboard");

  // Current POS password (settings table → env var fallback)
  const { data: pwSetting } = await admin.from("settings").select("value").eq("key", "pos_password").maybeSingle();
  const currentPassword = pwSetting?.value ?? process.env.POS_PASSWORD ?? "(not set)";

  // Recent POS activity — last 15 cash sales
  const { data: recentSales } = await admin
    .from("cash_sales")
    .select("id, created_at, amount, sale_type, staff_name, notes")
    .order("created_at", { ascending: false })
    .limit(15);

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
          Bookmark this on the register tablet. No login required — just the kiosk password below.
        </p>
      </div>

      {/* POS Password */}
      <div className="bg-white rounded-2xl shadow p-5">
        <h2 className="font-bold text-gray-800 mb-1">Kiosk Password</h2>
        <p className="text-sm text-gray-500 mb-4">
          Enter this once on the register tablet — it stays unlocked until changed.
        </p>

        {params.saved === "1" && (
          <div className="bg-green-50 text-green-700 text-sm rounded-xl px-4 py-2 mb-4 font-semibold">
            ✓ Password updated — re-enter it on the tablet to unlock.
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

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Recent POS Sales</h2>
          <a href="/admin/reports/cash" className="text-xs text-[#1a56db] hover:underline">
            View all in Sales →
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs">#</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs">Time</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs">Staff</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs">Type</th>
                <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(recentSales ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No POS sales yet.
                  </td>
                </tr>
              )}
              {(recentSales ?? []).map((s) => {
                const dt = new Date(s.created_at);
                const dateStr = dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
                const timeStr = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 text-xs">#{s.id}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {dateStr} {timeStr}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {s.staff_name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        s.sale_type === "membership" ? "bg-blue-100 text-blue-700"
                        : s.sale_type === "shop" ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-600"
                      }`}>
                        {s.sale_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {s.amount.toLocaleString()} THB
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

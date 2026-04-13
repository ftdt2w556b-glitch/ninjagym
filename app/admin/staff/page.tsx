import { createAdminClient } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import DeleteUserButton from "@/components/admin/DeleteUserButton";

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const admin = createAdminClient();
  const supabase = await createSupabaseServerClient();

  const { data: { user: currentUser } } = await supabase.auth.getUser();

  // Only admins may access this page
  const { data: currentProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", currentUser!.id)
    .single();
  if (currentProfile?.role !== "admin") redirect("/admin/dashboard");

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name, email, role, pin, show_on_pos, created_at")
    .order("created_at", { ascending: true });

  // Fetch pos_staff separately — fails gracefully if table doesn't exist yet
  const { data: posStaffList } = await admin
    .from("pos_staff")
    .select("id, name, pin_hash, active, created_at")
    .order("name");

  async function createStaff(formData: FormData) {
    "use server";
    const email = (formData.get("email") as string)?.trim();
    const password = formData.get("password") as string;
    const name = (formData.get("name") as string)?.trim();
    const role = formData.get("role") as string;

    if (!email || !password || !name) redirect("/admin/staff?error=missing");

    const adminClient = createAdminClient();
    const { data: user, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      redirect(`/admin/staff?error=${encodeURIComponent(error.message)}`);
    }
    if (user.user) {
      await adminClient
        .from("profiles")
        .update({ name, role })
        .eq("id", user.user.id);
    }
    redirect("/admin/staff?created=1");
  }

  async function togglePosRoster(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const current = formData.get("current") === "true";
    const adminClient = createAdminClient();
    await adminClient.from("profiles").update({ show_on_pos: !current }).eq("id", id);
    redirect("/admin/staff");
  }

  async function updateRole(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const role = formData.get("role") as string;
    const adminClient = createAdminClient();
    await adminClient.from("profiles").update({ role }).eq("id", id);
    redirect("/admin/staff");
  }

  async function resetPassword(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const password = (formData.get("password") as string)?.trim();
    if (!id || !password || password.length < 6) redirect("/admin/staff?error=Password+must+be+at+least+6+characters");
    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.updateUserById(id, { password });
    if (error) redirect(`/admin/staff?error=${encodeURIComponent(error.message)}`);
    redirect("/admin/staff?created=1");
  }

  async function setPin(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const pin = formData.get("pin") as string;
    if (!pin || pin.length < 4) redirect("/admin/staff");
    const hashed = await bcrypt.hash(pin, 10);
    const adminClient = createAdminClient();
    await adminClient.from("profiles").update({ pin: hashed }).eq("id", id);
    redirect("/admin/staff");
  }

  async function deleteUser(formData: FormData) {
    "use server";
    const userId = formData.get("userId") as string;
    if (!userId) return;

    // Safety: re-verify caller is admin/owner
    const supabaseInner = await createSupabaseServerClient();
    const { data: { user: caller } } = await supabaseInner.auth.getUser();
    if (!caller || caller.id === userId) return; // can't delete yourself

    const adminClient = createAdminClient();
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();
    if (!callerProfile || !["admin", "owner"].includes(callerProfile.role)) return;

    // Nullify FK references so deletion doesn't fail with constraint errors
    await Promise.allSettled([
      adminClient.from("cash_sales").update({ processed_by: null }).eq("processed_by", userId),
      adminClient.from("drawer_log").update({ opened_by: null }).eq("opened_by", userId),
      adminClient.from("staff_questions").update({ asked_by: null }).eq("asked_by", userId),
      adminClient.from("staff_questions").update({ answered_by: null }).eq("answered_by", userId),
      adminClient.from("staff_question_replies").update({ author_id: null }).eq("author_id", userId),
    ]);

    // Delete from Supabase Auth — profile cascades automatically
    await adminClient.auth.admin.deleteUser(userId);

    redirect("/admin/staff");
  }

  async function addPosStaff(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    if (!name?.trim()) redirect("/admin/staff");
    const adminClient = createAdminClient();
    await adminClient.from("pos_staff").insert({ name: name.trim() });
    redirect("/admin/staff");
  }

  async function setPosStaffPin(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const pin = formData.get("pin") as string;
    if (!pin || pin.length < 4) redirect("/admin/staff");
    const hashed = await bcrypt.hash(pin, 10);
    const adminClient = createAdminClient();
    await adminClient.from("pos_staff").update({ pin_hash: hashed }).eq("id", id);
    redirect("/admin/staff");
  }

  async function removePosStaff(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    if (!id) redirect("/admin/staff");
    const adminClient = createAdminClient();
    await adminClient.from("pos_staff").delete().eq("id", id);
    redirect("/admin/staff");
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">User Accounts</h1>

      {params.created === "1" && (
        <div className="bg-green-50 text-green-700 text-sm rounded-xl px-4 py-3 mb-6 font-semibold">
          ✓ Saved successfully.
        </div>
      )}
      {params.error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-6">
          {params.error === "missing" ? "Please fill in all fields." : `Error: ${params.error}`}
        </div>
      )}

      {/* Existing staff */}
      <div className="bg-white rounded-2xl shadow overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-3 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600">Role</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600">Change Role</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600">PIN</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600">Password</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600">On POS</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {profiles?.map((p) => {
                const isSelf = p.id === currentUser?.id;
                const isOwner = p.role === "owner";
                const canDelete = !isSelf && !isOwner;

                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {p.name ?? "—"}
                      {isSelf && <span className="ml-1 text-xs text-[#1a56db] font-semibold">(you)</span>}
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{p.email}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                        p.role === "admin"     ? "bg-purple-100 text-purple-700"
                        : p.role === "manager" ? "bg-teal-100 text-teal-700"
                        : p.role === "owner"   ? "bg-blue-100 text-blue-700"
                        : p.role === "tax"     ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-600"
                      }`}>
                        {p.role}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <form action={updateRole} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={p.id} />
                        <select name="role" defaultValue={p.role}
                          className="border border-gray-200 rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1a56db]">
                          <option value="staff">staff</option>
                          <option value="manager">manager</option>
                          <option value="admin">admin</option>
                          <option value="owner">owner</option>
                          <option value="tax">tax</option>
                        </select>
                        <button type="submit"
                          className="text-xs bg-[#1a56db] text-white px-2 py-1 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
                          Save
                        </button>
                      </form>
                    </td>
                    <td className="px-3 py-3">
                      <form action={setPin} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="password" name="pin" maxLength={4}
                          placeholder={p.pin ? "••••" : "PIN"}
                          className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-12 focus:outline-none focus:ring-1 focus:ring-[#1a56db]" />
                        <button type="submit"
                          className="text-xs bg-gray-600 text-white px-2 py-1 rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap">
                          {p.pin ? "Change" : "Set"}
                        </button>
                      </form>
                    </td>
                    <td className="px-3 py-3">
                      <form action={resetPassword} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="password" name="password" minLength={6}
                          placeholder="New password"
                          className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-[#1a56db]" />
                        <button type="submit"
                          className="text-xs bg-gray-600 text-white px-2 py-1 rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap">
                          Set
                        </button>
                      </form>
                    </td>
                    <td className="px-3 py-3">
                      <form action={togglePosRoster} className="flex items-center">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="current" value={String(p.show_on_pos ?? false)} />
                        <button
                          type="submit"
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                            p.show_on_pos ? "bg-green-500" : "bg-gray-200"
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            p.show_on_pos ? "translate-x-4" : "translate-x-1"
                          }`} />
                        </button>
                      </form>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {canDelete ? (
                        <DeleteUserButton
                          action={deleteUser}
                          userId={p.id}
                          userName={p.name ?? p.email ?? "this user"}
                        />
                      ) : (
                        <span className="text-xs text-gray-300">
                          {isSelf ? "you" : "protected"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add new staff */}
      <div className="bg-white rounded-2xl shadow p-6 max-w-md mb-10">
        <h2 className="font-bold text-gray-800 mb-4">Add User Account</h2>
        <form action={createStaff} className="flex flex-col gap-4">
          {[
            { name: "name",     label: "Full Name", type: "text",     placeholder: "e.g. Som Smith" },
            { name: "email",    label: "Email",     type: "email",    placeholder: "staff@ninjagym.com" },
            { name: "password", label: "Password",  type: "password", placeholder: "Minimum 8 characters" },
          ].map((f) => (
            <div key={f.name}>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{f.label}</label>
              <input type={f.type} name={f.name} required placeholder={f.placeholder}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
            <select name="role" defaultValue="staff"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]">
              <option value="staff">staff</option>
              <option value="manager">manager</option>
              <option value="admin">admin</option>
              <option value="owner">owner</option>
              <option value="tax">tax</option>
            </select>
          </div>
          <button type="submit"
            className="bg-[#1a56db] text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
            Create Account
          </button>
        </form>
      </div>

      {/* POS Staff (PIN Only) */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">POS Staff (PIN Only)</h2>
      <p className="text-sm text-gray-500 mb-4">
        These staff members can use the POS with a PIN but do not have dashboard accounts.
      </p>

      <div className="bg-white rounded-2xl shadow overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">PIN Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Set / Change PIN</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(posStaffList ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-sm">
                    No POS staff yet — add one below.
                  </td>
                </tr>
              )}
              {(posStaffList ?? []).map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3">
                    {p.pin_hash ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Set</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <form action={setPosStaffPin} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="password" name="pin" maxLength={8}
                        placeholder={p.pin_hash ? "••••" : "Set PIN"}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-[#1a56db]" />
                      <button type="submit"
                        className="text-xs bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 transition-colors">
                        {p.pin_hash ? "Change" : "Set"}
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <form action={removePosStaff}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit"
                        className="text-xs text-red-500 hover:text-red-700 transition-colors">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add POS Staff */}
      <div className="bg-white rounded-2xl shadow p-6 max-w-md">
        <h2 className="font-bold text-gray-800 mb-4">Add POS Staff</h2>
        <form action={addPosStaff} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
            <input type="text" name="name" required placeholder="e.g. Nong"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]" />
          </div>
          <button type="submit"
            className="bg-[#1a56db] text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
            Add POS Staff
          </button>
        </form>
      </div>
    </div>
  );
}

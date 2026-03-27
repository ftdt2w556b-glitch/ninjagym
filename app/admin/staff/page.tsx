import { createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function StaffPage() {
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name, email, role, created_at")
    .order("created_at", { ascending: true });

  async function createStaff(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;
    const role = formData.get("role") as string;

    const adminClient = createAdminClient();
    const { data: user, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (!error && user.user) {
      await adminClient
        .from("profiles")
        .update({ name, role })
        .eq("id", user.user.id);
    }
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

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Staff Accounts</h1>

      {/* Existing staff */}
      <div className="bg-white rounded-2xl shadow overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Change Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {profiles?.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{p.name ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{p.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    p.role === "admin" ? "bg-purple-100 text-purple-700"
                    : p.role === "owner" ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600"
                  }`}>
                    {p.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <form action={updateRole} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <select name="role" defaultValue={p.role}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1a56db]">
                      <option value="staff">staff</option>
                      <option value="admin">admin</option>
                      <option value="owner">owner</option>
                    </select>
                    <button type="submit"
                      className="text-xs bg-[#1a56db] text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors">
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add new staff */}
      <div className="bg-white rounded-2xl shadow p-6 max-w-md">
        <h2 className="font-bold text-gray-800 mb-4">Add Staff Account</h2>
        <form action={createStaff} className="flex flex-col gap-4">
          {[
            { name: "name", label: "Full Name", type: "text", placeholder: "e.g. Som Smith" },
            { name: "email", label: "Email", type: "email", placeholder: "staff@ninjagym.com" },
            { name: "password", label: "Password", type: "password", placeholder: "Minimum 8 characters" },
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
              <option value="admin">admin</option>
              <option value="owner">owner</option>
            </select>
          </div>
          <button type="submit"
            className="bg-[#1a56db] text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
            Create Account
          </button>
        </form>
      </div>
    </div>
  );
}

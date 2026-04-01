import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import WorkInstructionForm from "@/components/admin/WorkInstructionForm";

export default async function WorkInstructionsPage() {
  const admin = createAdminClient();
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager", "staff", "owner"].includes(profile?.role ?? "")) redirect("/admin/dashboard");

  const isAdmin = ["admin", "manager"].includes(profile?.role ?? "");

  const { data: instructions } = await admin
    .from("work_instructions")
    .select("*")
    .order("created_at", { ascending: false });

  async function saveInstruction(formData: FormData) {
    "use server";
    const serverSupabase = await createSupabaseServerClient();
    const { data: { user: actionUser } } = await serverSupabase.auth.getUser();
    if (!actionUser) redirect("/admin/login");
    const adminClient = createAdminClient();
    const { data: actionProfile } = await adminClient.from("profiles").select("role").eq("id", actionUser.id).single();
    if (!["admin", "manager"].includes(actionProfile?.role ?? "")) redirect("/admin/dashboard");

    const id = formData.get("id") as string;
    const topic_name = formData.get("topic_name") as string;
    const content = formData.get("instructions") as string;
    if (id) {
      await adminClient.from("work_instructions").update({ topic_name, instructions: content }).eq("id", id);
    } else {
      await adminClient.from("work_instructions").insert({ topic_name, instructions: content });
    }
    redirect("/admin/work-instructions");
  }

  async function deleteInstruction(formData: FormData) {
    "use server";
    const serverSupabase = await createSupabaseServerClient();
    const { data: { user: actionUser } } = await serverSupabase.auth.getUser();
    if (!actionUser) redirect("/admin/login");
    const adminClient = createAdminClient();
    const { data: actionProfile } = await adminClient.from("profiles").select("role").eq("id", actionUser.id).single();
    if (!["admin", "manager"].includes(actionProfile?.role ?? "")) redirect("/admin/dashboard");

    const id = formData.get("id") as string;
    await adminClient.from("work_instructions").delete().eq("id", id);
    redirect("/admin/work-instructions");
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Work Guide</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isAdmin
            ? "Add and edit staff procedures. Changes are visible to all staff immediately."
            : "Staff procedures and guidelines. Contact admin to request changes."}
        </p>
      </div>

      {/* Admin: add new topic */}
      {isAdmin && <WorkInstructionForm action={saveInstruction} />}

      {/* Topic list */}
      {instructions && instructions.length > 0 ? (
        <div className="flex flex-col gap-4">
          {instructions.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl shadow p-6">
              {isAdmin ? (
                /* Admin: editable */
                <>
                  <form action={saveInstruction} className="flex flex-col gap-3">
                    <input type="hidden" name="id" value={item.id} />
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Topic</label>
                      <input
                        name="topic_name"
                        defaultValue={item.topic_name}
                        required
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Instructions</label>
                      <textarea
                        name="instructions"
                        defaultValue={item.instructions ?? ""}
                        rows={8}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] resize-y"
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-[#1a56db] text-white font-bold py-2 rounded-xl hover:bg-blue-700 transition-colors text-sm"
                    >
                      Update
                    </button>
                  </form>
                  <form action={deleteInstruction} className="mt-2">
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      type="submit"
                      className="w-full text-xs text-red-400 hover:text-red-600 py-1 transition-colors"
                    >
                      Delete this topic
                    </button>
                  </form>
                </>
              ) : (
                /* Staff: read-only */
                <>
                  <h2 className="font-bold text-gray-900 text-base mb-3">{item.topic_name}</h2>
                  {item.instructions ? (
                    <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {item.instructions}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No instructions added yet.</p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow">
          {isAdmin
            ? "No topics yet. Add your first one above."
            : "No work guides published yet. Check back soon."}
        </div>
      )}
    </div>
  );
}

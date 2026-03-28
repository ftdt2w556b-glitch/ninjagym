import { createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function WorkInstructionsPage() {
  const admin = createAdminClient();
  const { data: instructions } = await admin
    .from("work_instructions")
    .select("*")
    .order("topic_name");

  async function saveInstruction(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const topic_name = formData.get("topic_name") as string;
    const instructions = formData.get("instructions") as string;
    const adminClient = createAdminClient();

    if (id) {
      await adminClient
        .from("work_instructions")
        .update({ topic_name, instructions })
        .eq("id", id);
    } else {
      await adminClient
        .from("work_instructions")
        .insert({ topic_name, instructions });
    }
    redirect("/admin/work-instructions");
  }

  async function deleteInstruction(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const adminClient = createAdminClient();
    await adminClient.from("work_instructions").delete().eq("id", id);
    redirect("/admin/work-instructions");
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Work Instructions</h1>
      <p className="text-sm text-gray-500 mb-6">Staff training docs and procedures. Visible to all staff.</p>

      {/* Add new */}
      <div className="bg-white rounded-2xl shadow p-6 mb-8">
        <h2 className="font-bold text-gray-800 mb-4">Add New Topic</h2>
        <form action={saveInstruction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value="" />
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Topic Name</label>
            <input
              name="topic_name"
              required
              placeholder="e.g. Opening Procedure, Scanner Troubleshooting"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Instructions</label>
            <textarea
              name="instructions"
              required
              rows={5}
              placeholder="Write step-by-step instructions here..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] resize-none"
            />
          </div>
          <button
            type="submit"
            className="bg-[#1a56db] text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
          >
            Save Topic
          </button>
        </form>
      </div>

      {/* Existing instructions */}
      {instructions && instructions.length > 0 ? (
        <div className="flex flex-col gap-4">
          {instructions.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl shadow p-5">
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
                    rows={6}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-[#1a56db] text-white font-bold py-2 rounded-xl hover:bg-blue-700 transition-colors text-sm"
                  >
                    Update
                  </button>
                </div>
              </form>
              <form action={deleteInstruction} className="mt-2">
                <input type="hidden" name="id" value={item.id} />
                <button
                  type="submit"
                  className="w-full text-xs text-red-500 hover:text-red-700 py-1"
                  onClick={(e) => { if (!confirm("Delete this topic?")) e.preventDefault(); }}
                >
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow">
          No work instructions yet. Add your first topic above.
        </div>
      )}
    </div>
  );
}

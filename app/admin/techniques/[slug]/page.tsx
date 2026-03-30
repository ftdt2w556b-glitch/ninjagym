import { createAdminClient } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

const BELT_STYLE: Record<string, { badge: string; bg: string; border: string }> = {
  yellow: { badge: "bg-yellow-400 text-yellow-900", bg: "bg-yellow-50",  border: "border-yellow-300" },
  orange: { badge: "bg-orange-400 text-white",       bg: "bg-orange-50",  border: "border-orange-300" },
  green:  { badge: "bg-green-500 text-white",         bg: "bg-green-50",   border: "border-green-300"  },
  blue:   { badge: "bg-blue-500 text-white",           bg: "bg-blue-50",    border: "border-blue-300"   },
  red:    { badge: "bg-red-500 text-white",             bg: "bg-red-50",     border: "border-red-300"    },
};

export default async function TechniqueDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: technique } = await admin
    .from("techniques")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!technique) notFound();

  // Get current user role
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await admin.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const isAdmin = ["admin", "manager"].includes(profile?.role ?? "");
  const style = BELT_STYLE[technique.belt_color] ?? BELT_STYLE.yellow;

  async function saveInstructions(formData: FormData) {
    "use server";
    const instructions = formData.get("instructions") as string;
    const id = formData.get("id") as string;
    const slugVal = formData.get("slug") as string;
    const adminClient = createAdminClient();
    await adminClient
      .from("techniques")
      .update({ instructions, updated_at: new Date().toISOString() })
      .eq("id", id);
    redirect(`/admin/techniques/${slugVal}`);
  }

  return (
    <div className="max-w-2xl">
      {/* Back link */}
      <Link href="/admin/techniques" className="text-sm text-[#1a56db] hover:underline mb-6 inline-flex items-center gap-1">
        ← Back to Techniques
      </Link>

      {/* Header card */}
      <div className={`rounded-2xl border ${style.border} ${style.bg} px-6 py-5 mt-4 mb-6`}>
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 px-3 py-1 rounded-full text-xs font-bold shrink-0 ${style.badge}`}>
            Level {technique.belt_level} · {technique.belt_color.charAt(0).toUpperCase() + technique.belt_color.slice(1)} Belt
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">{technique.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{technique.category}</p>
      </div>

      {/* Instructions display */}
      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="font-bold text-gray-800 mb-3">Instructions</h2>
        {technique.instructions ? (
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {technique.instructions}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No instructions added yet.</p>
        )}
      </div>

      {/* Admin edit form */}
      {isAdmin && (
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-bold text-gray-800 mb-3">
            {technique.instructions ? "Edit Instructions" : "Add Instructions"}
          </h2>
          <form action={saveInstructions} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={technique.id} />
            <input type="hidden" name="slug" value={technique.slug} />
            <textarea
              name="instructions"
              defaultValue={technique.instructions ?? ""}
              rows={10}
              placeholder={"Describe how to perform this technique step by step...\n\nExample:\n1. Stand in fighting stance\n2. Lift your knee...\n3. Extend your leg..."}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] resize-y"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="bg-[#1a56db] text-white font-bold px-6 py-2.5 rounded-xl hover:bg-blue-700 transition-colors text-sm"
              >
                Save Instructions
              </button>
              <Link
                href="/admin/techniques"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

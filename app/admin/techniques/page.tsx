import { createAdminClient } from "@/lib/supabase/server";
import Link from "next/link";

const BELT_CONFIG = [
  { level: 1, color: "yellow", label: "Yellow Belt", category: "Stances",  bg: "bg-yellow-50",  border: "border-yellow-300", badge: "bg-yellow-400 text-yellow-900", dot: "bg-yellow-400" },
  { level: 2, color: "orange", label: "Orange Belt", category: "Rolls",    bg: "bg-orange-50",  border: "border-orange-300", badge: "bg-orange-400 text-white",      dot: "bg-orange-400" },
  { level: 3, color: "green",  label: "Green Belt",  category: "Falls",    bg: "bg-green-50",   border: "border-green-300",  badge: "bg-green-500 text-white",       dot: "bg-green-500"  },
  { level: 4, color: "blue",   label: "Blue Belt",   category: "Strikes",  bg: "bg-blue-50",    border: "border-blue-300",   badge: "bg-blue-500 text-white",        dot: "bg-blue-500"   },
  { level: 5, color: "red",    label: "Red Belt",    category: "Kicks",    bg: "bg-red-50",     border: "border-red-300",    badge: "bg-red-500 text-white",         dot: "bg-red-500"    },
];

export default async function TechniquesPage() {
  const admin = createAdminClient();
  const { data: techniques } = await admin
    .from("techniques")
    .select("id, belt_level, belt_color, category, name, slug, instructions, display_order")
    .order("belt_level", { ascending: true })
    .order("display_order", { ascending: true });

  // Group by belt level
  const byLevel = BELT_CONFIG.map((belt) => ({
    ...belt,
    techniques: techniques?.filter((t) => t.belt_level === belt.level) ?? [],
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Techniques Guide</h1>
        <p className="text-sm text-gray-500 mt-1">Belt-level training requirements. Click a technique to view instructions.</p>
      </div>

      <div className="flex flex-col gap-6">
        {byLevel.map((belt) => (
          <div key={belt.level} className={`rounded-2xl border ${belt.border} ${belt.bg} overflow-hidden`}>
            {/* Belt header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-inherit">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${belt.badge}`}>
                Level {belt.level}
              </span>
              <div>
                <span className="font-bold text-gray-800 text-base">{belt.label}</span>
                <span className="ml-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">{belt.category}</span>
              </div>
              <span className="ml-auto text-xs text-gray-400">{belt.techniques.length} techniques</span>
            </div>

            {/* Technique list */}
            <div className="divide-y divide-white/60">
              {belt.techniques.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-400 italic">No techniques added yet.</p>
              ) : (
                belt.techniques.map((t, i) => (
                  <Link
                    key={t.id}
                    href={`/admin/techniques/${t.slug}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/60 transition-colors group"
                  >
                    <span className="text-xs font-bold text-gray-400 w-5 shrink-0">{i + 1}</span>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${belt.dot}`} />
                    <span className="text-sm font-medium text-gray-800 flex-1">{t.name}</span>
                    {t.instructions ? (
                      <span className="text-xs text-green-600 font-medium hidden sm:inline">✓ Instructions</span>
                    ) : (
                      <span className="text-xs text-gray-400 hidden sm:inline">No instructions</span>
                    )}
                    <span className="text-gray-300 group-hover:text-gray-500 transition-colors">›</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

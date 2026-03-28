import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const role = profile.role as string;

  const navLinks = [
    { href: "/admin/dashboard", label: "Dashboard", roles: ["admin", "staff", "owner"] },
    { href: "/admin/members", label: "Members", roles: ["admin", "staff", "owner"] },
    { href: "/admin/payments", label: "Payments", roles: ["admin", "staff"] },
    { href: "/admin/event-bookings", label: "Events", roles: ["admin", "staff", "owner"] },
    { href: "/admin/shop-orders", label: "Shop Orders", roles: ["admin", "staff"] },
    { href: "/admin/reports/cash", label: "Cash Report", roles: ["admin", "owner"] },
    { href: "/admin/staff", label: "Users", roles: ["admin"] },
    { href: "/admin/photos", label: "📸 Photos", roles: ["admin", "staff", "owner"] },
    { href: "/admin/techniques", label: "Techniques", roles: ["admin", "staff", "owner"] },
    { href: "/admin/work-instructions", label: "Work Guide", roles: ["admin", "staff", "owner"] },
    { href: "/admin/settings", label: "⚙️ Pricing", roles: ["admin", "owner"] },
    { href: "/admin/pos", label: "POS", roles: ["admin", "staff"] },
    { href: "/scanner", label: "Scanner", roles: ["admin", "staff"] },
  ].filter((link) => link.roles.includes(role));

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="mx-auto max-w-[900px] px-4 h-14 flex items-center justify-between">
          <Link href="/admin/dashboard" className="font-bold text-[#1a56db] text-lg">
            NinjaGym
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:block">
              {profile.name ?? user.email} ({role})
            </span>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="text-sm text-red-600 hover:underline"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Sub-nav */}
      <nav className="bg-white border-b border-gray-100">
        <div className="mx-auto max-w-[900px] px-4">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-blue-50 hover:text-[#1a56db] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="mx-auto max-w-[900px] px-4 py-6">{children}</main>
    </div>
  );
}

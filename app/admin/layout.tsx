import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/admin/LogoutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const admin = createAdminClient();

  // Run auth check and profile fetch in parallel once we have the client
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
    { href: "/admin/dashboard",         label: "Dash",      roles: ["admin", "manager", "staff", "owner"] },
    { href: "/admin/members",           label: "Members",   roles: ["admin", "manager", "staff", "owner"] },
    { href: "/admin/payments",          label: "Pending",   roles: ["admin", "manager", "staff"] },
    { href: "/admin/event-bookings",    label: "Events",    roles: ["admin", "manager", "staff", "owner"] },
    { href: "/admin/shop",              label: "Shop",      roles: ["admin", "manager"] },
    { href: "/admin/pos",               label: "POS",       roles: ["admin", "manager"] },
    { href: "https://ninjagym.com/pos", label: "Register", roles: ["admin", "manager", "staff"], external: true },
    { href: "/admin/reports/cash",      label: "Sales",     roles: ["admin", "manager", "owner"] },
    { href: "/admin/staff",             label: "Users",     roles: ["admin"] },
    { href: "/admin/photos",            label: "Photos",    roles: ["admin", "manager", "staff", "owner"] },
    { href: "/admin/techniques",        label: "Skills",    roles: ["admin", "manager", "staff", "owner"] },
    { href: "/admin/work-instructions", label: "Guide",     roles: ["admin", "manager", "staff", "owner"] },
    { href: "/admin/settings",          label: "Prices",    roles: ["admin"] },
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
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Sub-nav */}
      <nav className="bg-white border-b border-gray-100">
        <div className="mx-auto max-w-[900px] px-4">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-blue-50 hover:text-[#1a56db] transition-colors"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-blue-50 hover:text-[#1a56db] transition-colors"
                >
                  {link.label}
                </Link>
              )
            )}
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="mx-auto max-w-[900px] px-4 py-6">{children}</main>
    </div>
  );
}

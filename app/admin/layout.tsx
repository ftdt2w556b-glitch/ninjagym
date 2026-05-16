import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/admin/LogoutButton";
import StaffPinProvider from "@/components/admin/StaffPinProvider";
import StaffPinStatus from "@/components/admin/StaffPinStatus";

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

  // No entry-PIN gate: the shared NinjaGym login on the centre device is
  // the access point, and staff rotate through it freely. PIN attribution
  // happens per write action via <StaffPinProvider> below, so every
  // approve / reject / delete is correctly tied to the staff member who
  // performed it without forcing a 4-hour "session" concept that doesn't
  // match how the centre actually works.

  // Top-level nav ordered by daily-flow priority: Pending → Check-ins →
  // Timers are the three surfaces staff touch every shift, so they sit
  // together near the front. Members drops to the back as a lookup tool
  // (used only when a parent forgets their PIN).
  const navLinks = [
    { href: "/admin/dashboard",            label: "Dash",      roles: ["admin", "manager", "staff", "owner"] },
    { href: "/admin/payments",             label: "Pending",   roles: ["admin", "manager", "staff"] },
    { href: "/admin/members?tab=checkins", label: "Check-ins", roles: ["admin", "manager", "staff", "owner"] },
    { href: "/admin/members?tab=timers",   label: "Timers",    roles: ["admin", "manager", "staff", "owner"] },
    { href: "/admin/event-bookings",       label: "Events",    roles: ["admin", "manager", "staff", "owner"] },
    { href: "/admin/shop",                 label: "Shop",      roles: ["admin", "manager"] },
    { href: "/admin/pos",                  label: "POS",       roles: ["admin", "manager"] },
    { href: "/admin/reports/cash",         label: "Sales",     roles: ["admin", "manager", "owner", "tax"] },
    { href: "/admin/tax",                  label: "Tax",       roles: ["admin", "owner", "tax"] },
    { href: "/admin/members",              label: "Members",   roles: ["admin", "manager", "staff", "owner"] },
    { href: "/admin/staff",                label: "Users",     roles: ["admin"] },
    { href: "/admin/photos",               label: "Photos",    roles: ["admin", "manager", "staff", "owner"] },
    { href: "/admin/techniques",           label: "Skills",    roles: ["admin", "manager", "staff", "owner"] },
    { href: "/admin/work-instructions",    label: "Guide",     roles: ["admin", "manager", "staff", "owner"] },
    { href: "/admin/settings",             label: "Prices",    roles: ["admin"] },
  ].filter((link) => link.roles.includes(role));

  return (
    // PIN provider wraps the entire layout so the header chip + page
    // content share one write-cookie state. Without this the chip would
    // need its own polling loop.
    <StaffPinProvider>
      <div className="min-h-dvh bg-gray-50">
        {/* Top nav */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="mx-auto max-w-[900px] px-4 h-14 flex items-center justify-between">
            <Link href="/admin/dashboard" className="font-bold text-[#1a56db] text-lg">
              NinjaGym
            </Link>
            <div className="flex items-center gap-3">
              <StaffPinStatus />
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

        <main className="mx-auto max-w-[900px] px-4 py-6">{children}</main>
      </div>
    </StaffPinProvider>
  );
}

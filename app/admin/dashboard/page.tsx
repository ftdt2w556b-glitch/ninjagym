import { createAdminClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const admin = createAdminClient();

  const today = new Date().toISOString().split("T")[0];

  const [
    { count: todayCheckIns },
    { count: pendingPayments },
    { count: pendingEvents },
    { count: pendingOrders },
    { count: pendingPhotos },
  ] = await Promise.all([
    admin
      .from("attendance_logs")
      .select("*", { count: "exact", head: true })
      .gte("check_in_at", `${today}T00:00:00`)
      .lte("check_in_at", `${today}T23:59:59`),
    admin
      .from("member_registrations")
      .select("*", { count: "exact", head: true })
      .eq("slip_status", "pending_review"),
    admin
      .from("event_bookings")
      .select("*", { count: "exact", head: true })
      .eq("slip_status", "pending_review"),
    admin
      .from("shop_orders")
      .select("*", { count: "exact", head: true })
      .eq("slip_status", "pending_review"),
    admin
      .from("marketing_photos")
      .select("*", { count: "exact", head: true })
      .eq("approved", false),
  ]);

  const stats = [
    { label: "Check-ins Today", value: todayCheckIns ?? 0, color: "bg-blue-100 text-blue-800", href: "/scanner" },
    { label: "Pending Payments", value: pendingPayments ?? 0, color: "bg-yellow-100 text-yellow-800", href: "/admin/payments" },
    { label: "Pending Events", value: pendingEvents ?? 0, color: "bg-purple-100 text-purple-800", href: "/admin/event-bookings" },
    { label: "Pending Orders", value: pendingOrders ?? 0, color: "bg-green-100 text-green-800", href: "/admin/shop-orders" },
    { label: "Photos to Review", value: pendingPhotos ?? 0, color: "bg-pink-100 text-pink-800", href: "/admin/photos" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Daily Dashboard</h1>
      <p className="text-gray-500 text-sm mb-6">
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className={`rounded-2xl p-5 ${stat.color} flex flex-col hover:opacity-80 transition-opacity`}
          >
            <span className="text-3xl font-bold">{stat.value}</span>
            <span className="text-sm font-medium mt-1">{stat.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="/scanner"
          className="block bg-[#1a56db] text-white rounded-2xl p-5 text-center font-bold text-lg hover:bg-blue-700 transition-colors"
        >
          QR Scanner
        </a>
        <a
          href="/admin/pos"
          className="block bg-[#22c55e] text-white rounded-2xl p-5 text-center font-bold text-lg hover:bg-green-600 transition-colors"
        >
          POS Counter
        </a>
      </div>
    </div>
  );
}

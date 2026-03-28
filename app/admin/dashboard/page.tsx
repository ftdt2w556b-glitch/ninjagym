import { createAdminClient } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const admin = createAdminClient();
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await admin.from("profiles").select("role, name").eq("id", user.id).single()
    : { data: null };

  const isAdminOrOwner = profile?.role === "admin" || profile?.role === "owner";

  const today = new Date().toISOString().split("T")[0];

  const [
    { count: todayCheckIns },
    { count: pendingPayments },
    { count: pendingEvents },
    { count: pendingOrders },
    { count: pendingPhotos },
    { data: questions },
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
    admin
      .from("staff_questions")
      .select("id, asker_name, question, answer, answered_at, answered_by")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const stats = [
    { label: "Check-ins Today",  value: todayCheckIns ?? 0,    color: "bg-blue-100 text-blue-800",     href: "/scanner" },
    { label: "Pending Payments", value: pendingPayments ?? 0,  color: "bg-yellow-100 text-yellow-800", href: "/admin/payments" },
    { label: "Pending Events",   value: pendingEvents ?? 0,    color: "bg-purple-100 text-purple-800", href: "/admin/event-bookings" },
    { label: "Pending Orders",   value: pendingOrders ?? 0,    color: "bg-green-100 text-green-800",   href: "/admin/shop-orders" },
    { label: "Photos to Review", value: pendingPhotos ?? 0,    color: "bg-pink-100 text-pink-800",     href: "/admin/photos" },
  ];

  // Server actions
  async function askQuestion(formData: FormData) {
    "use server";
    const question = (formData.get("question") as string)?.trim();
    if (!question) return;
    const supabaseInner = await createSupabaseServerClient();
    const { data: { user: u } } = await supabaseInner.auth.getUser();
    if (!u) return;
    const adminClient = createAdminClient();
    const { data: p } = await adminClient.from("profiles").select("name").eq("id", u.id).single();
    await adminClient.from("staff_questions").insert({
      asked_by: u.id,
      asker_name: p?.name ?? u.email ?? "Staff",
      question,
    });
    redirect("/admin/dashboard");
  }

  async function answerQuestion(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const answer = (formData.get("answer") as string)?.trim();
    if (!answer || !id) return;
    const supabaseInner = await createSupabaseServerClient();
    const { data: { user: u } } = await supabaseInner.auth.getUser();
    if (!u) return;
    const adminClient = createAdminClient();
    await adminClient.from("staff_questions").update({
      answer,
      answered_by: u.id,
      answered_at: new Date().toISOString(),
    }).eq("id", id);
    redirect("/admin/dashboard");
  }

  const unanswered = questions?.filter((q) => !q.answer) ?? [];
  const answered   = questions?.filter((q) => !!q.answer) ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Daily Dashboard</h1>
      <p className="text-gray-500 text-sm mb-6">
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>

      {/* Stats grid */}
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

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 mb-10">
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

      {/* ── Q&A Widget ── */}
      <div className="border-t border-gray-200 pt-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Staff Q&amp;A</h2>

        {/* Admin: unanswered questions to answer */}
        {isAdminOrOwner && unanswered.length > 0 && (
          <div className="mb-6 flex flex-col gap-3">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">
              {unanswered.length} question{unanswered.length !== 1 ? "s" : ""} waiting for your answer
            </p>
            {unanswered.map((q) => (
              <div key={q.id} className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                <p className="text-xs text-gray-500 mb-1 font-medium">{q.asker_name} asked:</p>
                <p className="text-sm text-gray-800 font-medium mb-3">{q.question}</p>
                <form action={answerQuestion} className="flex flex-col gap-2">
                  <input type="hidden" name="id" value={q.id} />
                  <textarea
                    name="answer"
                    rows={2}
                    placeholder="Type your answer..."
                    required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] resize-none"
                  />
                  <button
                    type="submit"
                    className="self-start bg-[#1a56db] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Post Answer
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        {/* Staff: pending questions notice */}
        {!isAdminOrOwner && unanswered.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            {unanswered.map((q) => (
              <div key={q.id} className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                <p className="text-xs text-gray-500 mb-1">{q.asker_name} asked:</p>
                <p className="text-sm text-gray-700">{q.question}</p>
                <p className="text-xs text-yellow-600 mt-2 font-medium">⏳ Waiting for admin reply...</p>
              </div>
            ))}
          </div>
        )}

        {/* Answered questions */}
        {answered.length > 0 && (
          <div className="flex flex-col gap-3 mb-6">
            {answered.map((q) => (
              <div key={q.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">{q.asker_name} asked:</p>
                <p className="text-sm text-gray-700 mb-2 font-medium">{q.question}</p>
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-[#1a56db] font-semibold mb-1">Admin answer:</p>
                  <p className="text-sm text-gray-800">{q.answer}</p>
                  {q.answered_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(q.answered_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {questions?.length === 0 && (
          <p className="text-sm text-gray-400 italic mb-6">No questions yet. Be the first to ask!</p>
        )}

        {/* Ask a question form */}
        <div className="bg-gray-50 rounded-2xl p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Ask Admin a Question</p>
          <form action={askQuestion} className="flex flex-col gap-3">
            <textarea
              name="question"
              rows={3}
              required
              placeholder="What would you like to know? e.g. How do I handle a refund request?"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] resize-none bg-white"
            />
            <button
              type="submit"
              className="self-start bg-gray-800 text-white text-sm font-bold px-5 py-2 rounded-xl hover:bg-gray-700 transition-colors"
            >
              Send Question
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

import { createAdminClient } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { bangkokStartOfDay, bangkokEndOfDay } from "@/lib/timezone";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import DeleteQuestionButton from "@/components/admin/DeleteQuestionButton";
import QaSubmitButton from "@/components/admin/QaSubmitButton";

export default async function DashboardPage() {
  const admin = createAdminClient();
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await admin.from("profiles").select("role, name").eq("id", user.id).single()
    : { data: null };

  const isAdminOrOwner = ["admin", "manager", "owner"].includes(profile?.role ?? "");

  const [
    { count: todayCheckIns },
    { count: pendingPayments },
    { count: pendingEvents },
    { count: pendingOrders },
    { count: pendingPhotos },
    { data: rawQuestions },
    { data: todayApproved },
  ] = await Promise.all([
    admin
      .from("attendance_logs")
      .select("*", { count: "exact", head: true })
      .gte("check_in_at", bangkokStartOfDay())
      .lte("check_in_at", bangkokEndOfDay()),
    admin
      .from("member_registrations")
      .select("*", { count: "exact", head: true })
      .neq("membership_type", "birthday_event")
      .in("slip_status", ["pending_review", "cash_pending"]),
    admin
      .from("event_bookings")
      .select("*", { count: "exact", head: true })
      .in("slip_status", ["pending_review", "cash_pending"]),
    admin
      .from("shop_orders")
      .select("*", { count: "exact", head: true })
      .in("slip_status", ["pending_review", "cash_pending"]),
    admin
      .from("marketing_photos")
      .select("*", { count: "exact", head: true })
      .eq("approved", false),
    // Use select("*") so missing columns (resolved) don't crash the query
    admin
      .from("staff_questions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("member_registrations")
      .select("amount_paid")
      .eq("slip_status", "approved")
      .gte("slip_reviewed_at", bangkokStartOfDay())
      .lte("slip_reviewed_at", bangkokEndOfDay()),
  ]);

  // Fetch replies separately — fails gracefully if table doesn't exist yet
  type Reply = { id: number; question_id: number; author_name: string; body: string; created_at: string };
  let repliesMap: Record<number, Reply[]> = {};
  if (rawQuestions && rawQuestions.length > 0) {
    const ids = rawQuestions.map((q: { id: number }) => q.id);
    const { data: replies } = await admin
      .from("staff_question_replies")
      .select("id, question_id, author_name, body, created_at")
      .in("question_id", ids)
      .order("created_at", { ascending: true });
    if (replies) {
      for (const r of replies as Reply[]) {
        if (!repliesMap[r.question_id]) repliesMap[r.question_id] = [];
        repliesMap[r.question_id].push(r);
      }
    }
  }

  const revenueToday = todayApproved?.reduce((sum, r) => sum + Number(r.amount_paid ?? 0), 0) ?? 0;
  // Events merged into the single Pending count for everyone
  const totalPending = (pendingPayments ?? 0) + (pendingOrders ?? 0) + (pendingEvents ?? 0);

  const stats = [
    // Check-ins stat only useful for admin/owner (staff just use the Scanner button)
    ...(isAdminOrOwner
      ? [{ label: "Check-ins Today", value: todayCheckIns ?? 0, color: "bg-blue-100 text-blue-800", href: "/scanner" }]
      : []),
    { label: "Pending",          value: totalPending,   color: "bg-yellow-100 text-yellow-800", href: "/admin/payments" },
    { label: "Photos to Review", value: pendingPhotos ?? 0, color: "bg-pink-100 text-pink-800", href: "/admin/photos" },
    ...(isAdminOrOwner
      ? [{ label: "Revenue Today", value: `฿${revenueToday.toLocaleString()}`, color: "bg-emerald-100 text-emerald-800", href: "/admin/reports/cash" }]
      : []),
  ];

  // ── Server Actions ──────────────────────────────────────────────────────────

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
    revalidatePath("/admin/dashboard");
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
    revalidatePath("/admin/dashboard");
  }

  async function addReply(formData: FormData) {
    "use server";
    const question_id = Number(formData.get("question_id"));
    const body = (formData.get("body") as string)?.trim();
    if (!body || !question_id) return;
    const supabaseInner = await createSupabaseServerClient();
    const { data: { user: u } } = await supabaseInner.auth.getUser();
    if (!u) return;
    const adminClient = createAdminClient();
    const { data: p } = await adminClient.from("profiles").select("name").eq("id", u.id).single();
    await adminClient.from("staff_question_replies").insert({
      question_id,
      author_id: u.id,
      author_name: p?.name ?? u.email ?? "Staff",
      body,
    });
    revalidatePath("/admin/dashboard");
  }

  async function toggleResolved(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const current = formData.get("resolved") === "true";
    const adminClient = createAdminClient();
    await adminClient.from("staff_questions").update({ resolved: !current }).eq("id", id);
    revalidatePath("/admin/dashboard");
  }

  async function deleteQuestion(formData: FormData) {
    "use server";
    // re-verify role server-side
    const supabaseInner = await createSupabaseServerClient();
    const { data: { user: u } } = await supabaseInner.auth.getUser();
    if (!u) return;
    const adminClient = createAdminClient();
    const { data: p } = await adminClient.from("profiles").select("role").eq("id", u.id).single();
    if (!["admin", "manager"].includes(p?.role ?? "")) return;
    const id = formData.get("id") as string;
    await adminClient.from("staff_questions").delete().eq("id", id);
    revalidatePath("/admin/dashboard");
  }

  // ── Partition questions ─────────────────────────────────────────────────────
  type Question = {
    id: number; asker_name: string; question: string;
    answer: string | null; answered_at: string | null; answered_by: string | null;
    resolved: boolean | null; created_at: string;
  };

  const allQuestions = (rawQuestions ?? []) as Question[];
  const openQuestions     = allQuestions.filter((q) => !q.resolved);
  const resolvedQuestions = allQuestions.filter((q) => !!q.resolved);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Daily Dashboard</h1>
      <p className="text-gray-500 text-sm mb-6">
        {new Date().toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        })}
      </p>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}
            className={`rounded-2xl p-5 ${stat.color} flex flex-col hover:opacity-80 transition-opacity`}>
            <span className="text-3xl font-bold">{stat.value}</span>
            <span className="text-sm font-medium mt-1">{stat.label}</span>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 mb-10">
        <a href="/scanner"
          className="block bg-[#1a56db] text-white rounded-2xl p-5 text-center font-bold text-lg hover:bg-blue-700 transition-colors">
          📷 QR Scanner
        </a>
        {isAdminOrOwner && (
          <a href="/admin/pos"
            className="block bg-[#22c55e] text-white rounded-2xl p-5 text-center font-bold text-lg hover:bg-green-600 transition-colors">
            🛒 POS Counter
          </a>
        )}
        <a href="/join"
          className="block bg-orange-500 text-white rounded-2xl p-5 text-center font-bold text-lg hover:bg-orange-600 transition-colors">
          ➕ New Registration
        </a>
        {isAdminOrOwner && (
          <a href="/admin/payments"
            className="block bg-yellow-500 text-white rounded-2xl p-5 text-center font-bold text-lg hover:bg-yellow-600 transition-colors">
            💳 Review Pending
          </a>
        )}
      </div>

      {/* ── Q&A Widget ── */}
      <div className="border-t border-gray-200 pt-8">
        <h2 className="text-lg font-bold text-gray-800 mb-5">Staff Q&amp;A</h2>

        {/* Open threads */}
        {openQuestions.length === 0 && resolvedQuestions.length === 0 && (
          <p className="text-sm text-gray-400 italic mb-6">No questions yet. Be the first to ask!</p>
        )}

        {openQuestions.length > 0 && (
          <div className="flex flex-col gap-4 mb-6">
            {openQuestions.map((q) => {
              const replies = repliesMap[q.id] ?? [];
              const isAnswered = !!q.answer;

              return (
                <div key={q.id} className={`rounded-2xl border shadow-sm overflow-hidden ${
                  isAnswered ? "border-gray-200 bg-white" : "border-orange-200 bg-orange-50"
                }`}>
                  {/* Question header */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-500">{q.asker_name}</span>
                        <span className="text-xs text-gray-400">{formatDate(q.created_at)}</span>
                        {!isAnswered && (
                          <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">
                            ⏳ Awaiting answer
                          </span>
                        )}
                      </div>
                      {/* Admin controls */}
                      {isAdminOrOwner && (
                        <div className="flex items-center gap-2 shrink-0">
                          <form action={toggleResolved}>
                            <input type="hidden" name="id" value={q.id} />
                            <input type="hidden" name="resolved" value={String(!!q.resolved)} />
                            <QaSubmitButton label="✓ Resolve" pendingLabel="..." className="text-xs bg-green-100 text-green-700 font-semibold px-2.5 py-1 rounded-lg hover:bg-green-200" />
                          </form>
                          <DeleteQuestionButton action={deleteQuestion} id={q.id} />
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 font-medium">{q.question}</p>
                  </div>

                  {/* Admin answer */}
                  {isAnswered && (
                    <div className="mx-4 mb-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                      <p className="text-xs font-semibold text-[#1a56db] mb-1">Admin answer</p>
                      <p className="text-sm text-gray-800">{q.answer}</p>
                      {q.answered_at && (
                        <p className="text-xs text-gray-400 mt-1">{formatDate(q.answered_at)}</p>
                      )}
                    </div>
                  )}

                  {/* Follow-up replies */}
                  {replies.length > 0 && (
                    <div className="mx-4 mb-3 flex flex-col gap-2 pl-3 border-l-2 border-gray-200">
                      {replies.map((r) => (
                        <div key={r.id} className="text-sm">
                          <span className="font-semibold text-gray-700 text-xs">{r.author_name}</span>
                          <span className="text-gray-400 text-xs ml-2">{formatDate(r.created_at)}</span>
                          <p className="text-gray-700 mt-0.5">{r.body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Admin: answer form (if unanswered) */}
                  {isAdminOrOwner && !isAnswered && (
                    <div className="px-4 pb-4">
                      <form action={answerQuestion} className="flex flex-col gap-2">
                        <input type="hidden" name="id" value={q.id} />
                        <textarea name="answer" rows={2} required placeholder="Type your answer..."
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] resize-none bg-white" />
                        <QaSubmitButton label="Post Answer" pendingLabel="Posting..." className="self-start bg-[#1a56db] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700" />
                      </form>
                    </div>
                  )}

                  {/* Follow-up reply form (everyone, shown after an answer exists) */}
                  {isAnswered && (
                    <div className="px-4 pb-4">
                      <form action={addReply} className="flex gap-2">
                        <input type="hidden" name="question_id" value={q.id} />
                        <input type="text" name="body" required placeholder="Follow-up reply..."
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] bg-white" />
                        <QaSubmitButton label="Reply" pendingLabel="..." className="shrink-0 bg-gray-700 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-gray-800" />
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Resolved threads (collapsed) */}
        {resolvedQuestions.length > 0 && (
          <details className="mb-6">
            <summary className="text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-600 mb-3 select-none">
              ✓ {resolvedQuestions.length} Resolved Thread{resolvedQuestions.length !== 1 ? "s" : ""}
            </summary>
            <div className="flex flex-col gap-3 mt-3">
              {resolvedQuestions.map((q) => {
                const replies = repliesMap[q.id] ?? [];
                return (
                  <div key={q.id} className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden opacity-75">
                    <div className="px-4 pt-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs text-gray-400">{q.asker_name} · {formatDate(q.created_at)}</span>
                          <p className="text-sm text-gray-600 mt-0.5">{q.question}</p>
                        </div>
                        {isAdminOrOwner && (
                          <div className="flex items-center gap-2 shrink-0">
                            <form action={toggleResolved}>
                              <input type="hidden" name="id" value={q.id} />
                              <input type="hidden" name="resolved" value={String(!!q.resolved)} />
                              <QaSubmitButton label="↩ Reopen" pendingLabel="..." className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-200" />
                            </form>
                            <DeleteQuestionButton action={deleteQuestion} id={q.id} />
                          </div>
                        )}
                      </div>
                    </div>
                    {q.answer && (
                      <div className="mx-4 mb-2 bg-blue-50 rounded-xl px-3 py-2">
                        <p className="text-xs text-[#1a56db] font-semibold mb-0.5">Answer</p>
                        <p className="text-xs text-gray-700">{q.answer}</p>
                      </div>
                    )}
                    {replies.length > 0 && (
                      <div className="mx-4 mb-3 pl-3 border-l-2 border-gray-200 flex flex-col gap-1">
                        {replies.map((r) => (
                          <div key={r.id} className="text-xs text-gray-500">
                            <span className="font-semibold">{r.author_name}:</span> {r.body}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {/* Ask a new question */}
        <div className="bg-gray-50 rounded-2xl p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Ask Admin a Question</p>
          <form action={askQuestion} className="flex flex-col gap-3">
            <textarea name="question" rows={3} required
              placeholder="What would you like to know? e.g. How do I handle a refund request?"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] resize-none bg-white" />
            <QaSubmitButton label="Send Question" pendingLabel="Sending..." className="self-start bg-gray-800 text-white text-sm font-bold px-5 py-2 rounded-xl hover:bg-gray-700" />
          </form>
        </div>
      </div>
    </div>
  );
}

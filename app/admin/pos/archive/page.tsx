import { createAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { bangkokToday } from "@/lib/timezone";
import VoidTransactionButton from "@/components/admin/VoidTransactionButton";
import EditNotes1kButton from "@/components/admin/EditNotes1kButton";

async function editNotes1k(formData: FormData) {
  "use server";
  const id      = formData.get("id") as string;
  const notes1k = Number(formData.get("notes1k") ?? 0);
  if (!id) return;
  const { createAdminClient: makeAdmin, createSupabaseServerClient: makeClient } = await import("@/lib/supabase/server");
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const admin = makeAdmin();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) return;
  await admin.from("cash_sales").update({ notes_1k: notes1k }).eq("id", Number(id));
  revalidatePath("/admin/pos/archive");
}

async function voidCashSale(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  const { createAdminClient: makeAdmin, createSupabaseServerClient: makeClient } =
    await import("@/lib/supabase/server");
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const admin = makeAdmin();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) return;
  await admin.from("drawer_log").delete().eq("sale_id", Number(id));
  await admin.from("tax_invoices").delete().eq("cash_sale_id", Number(id));
  await admin.from("cash_sales").delete().eq("id", Number(id));
  revalidatePath("/admin/pos/archive");
}

type Mode = "day" | "month" | "year";
const PAGE_SIZE = 50;

function buildRange(mode: Mode, date: string): { from: string; to: string; label: string } {
  if (mode === "day") {
    return {
      from: `${date}T00:00:00+07:00`,
      to:   `${date}T23:59:59+07:00`,
      label: new Date(date + "T12:00:00+07:00").toLocaleDateString("en-US", {
        timeZone: "Asia/Bangkok", weekday: "long", day: "numeric", month: "long", year: "numeric",
      }).toUpperCase(),
    };
  }
  if (mode === "month") {
    const [y, m] = date.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const mm = String(m).padStart(2, "0");
    return {
      from: `${y}-${mm}-01T00:00:00+07:00`,
      to:   `${y}-${mm}-${lastDay}T23:59:59+07:00`,
      label: new Date(y, m - 1).toLocaleDateString("en-US", {
        timeZone: "Asia/Bangkok", month: "long", year: "numeric",
      }).toUpperCase(),
    };
  }
  const y = date;
  return {
    from: `${y}-01-01T00:00:00+07:00`,
    to:   `${y}-12-31T23:59:59+07:00`,
    label: `YEAR ${y}`,
  };
}

function defaultDate(mode: Mode): string {
  const now = new Date();
  if (mode === "day") return bangkokToday();
  if (mode === "month") {
    const d = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return String(new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })).getFullYear());
}

function inputType(mode: Mode) {
  if (mode === "day")   return "date";
  if (mode === "month") return "month";
  return "number";
}

export default async function PosArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string; page?: string }>;
}) {
  const { mode: rawMode, date: rawDate, page: rawPage } = await searchParams;
  const mode: Mode = (rawMode === "month" || rawMode === "year") ? rawMode : "day";
  const date = rawDate ?? defaultDate(mode);
  const page = Math.max(1, parseInt(rawPage ?? "1", 10));
  const { from, to, label } = buildRange(mode, date);

  const admin = createAdminClient();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user!.id).single();
  if (!["admin", "manager", "owner"].includes(profile?.role ?? "")) redirect("/admin/dashboard");
  const canManage = ["admin", "manager"].includes(profile?.role ?? "");

  // Total count for pagination + grand total
  const [{ count: totalCount }, { data: allAmounts }] = await Promise.all([
    admin
      .from("cash_sales")
      .select("*", { count: "exact", head: true })
      .gte("processed_at", from)
      .lte("processed_at", to),
    admin
      .from("cash_sales")
      .select("amount")
      .gte("processed_at", from)
      .lte("processed_at", to),
  ]);

  const total = totalCount ?? 0;
  const grandTotal = (allAmounts ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;

  // Paged results
  const { data: sales } = await admin
    .from("cash_sales")
    .select("id, processed_at, amount, change_given, sale_type, staff_name, notes, items, notes_1k")
    .gte("processed_at", from)
    .lte("processed_at", to)
    .order("processed_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const exportUrl = `/api/pos/archive/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin/pos" className="text-sm text-gray-400 hover:text-gray-600">
            ← POS Register
          </Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">POS Sales Archive</h1>
          <p className="text-sm text-gray-400 mt-0.5">All POS cash transactions · searchable by date</p>
        </div>
        <a
          href={exportUrl}
          className="bg-[#22c55e] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-green-600 transition-colors"
        >
          Export CSV
        </a>
      </div>

      {/* Mode toggle + date picker */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
          {(["day", "month", "year"] as Mode[]).map((m) => (
            <Link
              key={m}
              href={`?mode=${m}&date=${defaultDate(m)}`}
              className={`px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                mode === m ? "bg-[#1a56db] text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {m === "day" ? "Day" : m === "month" ? "Month" : "Year"}
            </Link>
          ))}
        </div>
        <form method="GET" className="flex gap-2 items-end">
          <input type="hidden" name="mode" value={mode} />
          <input
            type={inputType(mode)}
            name="date"
            defaultValue={date}
            min={mode === "year" ? "2020" : undefined}
            max={mode === "year" ? "2100" : undefined}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
          />
          <button
            type="submit"
            className="bg-[#1a56db] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Go
          </button>
        </form>
      </div>

      <p className="text-sm font-bold text-gray-700 mb-4">{label}</p>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-3xl font-bold text-green-600">฿{grandTotal.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">Cash Collected</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-5">
          <p className="text-3xl font-bold text-gray-700">{total}</p>
          <p className="text-sm text-gray-500 mt-1">POS Transactions</p>
        </div>
      </div>

      {/* Transaction table */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">
            Transactions
            <span className="ml-2 text-sm font-normal text-gray-400">
              {total > PAGE_SIZE
                ? `(${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total})`
                : `(${total})`}
            </span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">#</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Time</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Staff</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">Description</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs">Amount</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs">Change</th>
                {canManage && <th className="px-4 py-3 font-semibold text-gray-600 text-xs text-center">Box</th>}
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(sales ?? []).map((s) => {
                const dt = new Date(s.processed_at as string);
                const timeStr = dt.toLocaleString("en-US", {
                  timeZone: "Asia/Bangkok",
                  month: "short", day: "numeric",
                  hour: "numeric", minute: "2-digit", hour12: true,
                });
                const items = Array.isArray(s.items)
                  ? (s.items as { type?: string }[])
                  : null;
                const typeLabel = items
                  ? [...new Set(items.map((i) => i.type).filter(Boolean))].join(", ")
                  : (s.sale_type ?? "POS Sale");
                const desc = (s.notes as string | null) ?? typeLabel;
                const notes1k   = Number((s as Record<string, unknown>).notes_1k ?? 0);
                const tendered  = Number((s as Record<string, unknown>).amount_tendered ?? 0);
                const suspicious = canManage && tendered >= 1000 && notes1k === 0;

                return (
                  <tr key={s.id as number} className={suspicious ? "bg-yellow-50 hover:bg-yellow-100" : "hover:bg-gray-50"}>
                    <td className="px-4 py-3 text-gray-400 text-xs">#{s.id as number}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{timeStr}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {(s.staff_name as string | null) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[240px]">
                      <span className="line-clamp-1">{desc}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 text-right tabular-nums">
                      ฿{Number(s.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {(s as Record<string, unknown>).change_given != null ? (
                        <span className="text-orange-500 font-semibold">
                          -฿{Number((s as Record<string, unknown>).change_given).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {suspicious && (
                            <span className="text-xs font-semibold text-yellow-600">⚠️ check</span>
                          )}
                          <EditNotes1kButton
                            action={editNotes1k}
                            id={s.id as number}
                            current={notes1k}
                          />
                        </div>
                      </td>
                    )}
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <VoidTransactionButton
                          action={voidCashSale}
                          id={s.id as number}
                          source="cash_sale"
                          description={desc}
                          amount={Number(s.amount)}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
              {(sales ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={canManage ? 8 : 6}
                    className="px-4 py-10 text-center text-gray-400"
                  >
                    No POS sales recorded for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-gray-400">
              Page {safePage} of {totalPages}
            </span>
            <div className="flex gap-1 flex-wrap">
              {safePage > 1 && (
                <Link
                  href={`?mode=${mode}&date=${date}&page=${safePage - 1}`}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  ← Prev
                </Link>
              )}
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <Link
                    key={p}
                    href={`?mode=${mode}&date=${date}&page=${p}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      p === safePage
                        ? "bg-[#1a56db] text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {p}
                  </Link>
                );
              })}
              {safePage < totalPages && (
                <Link
                  href={`?mode=${mode}&date=${date}&page=${safePage + 1}`}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

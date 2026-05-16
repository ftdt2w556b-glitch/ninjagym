"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * Debounced as-you-type filter for the Members directory.
 *
 * Staff lookup pattern: parent walks up without their card, staff types
 * half a name, expects rows to filter live. The old form-submit flow
 * meant a full page reload per query.
 *
 * Implementation: keep the `q` URL param in sync with the input via
 * router.replace, debounced 300ms. Server still does the filter (so the
 * 500+ row table doesn't ship to the client), but the round-trip happens
 * automatically as the user types instead of waiting on a click.
 *
 * Plain-form fallback preserved via the Search button + Enter handler
 * so non-JS clients keep working.
 */
const DEBOUNCE_MS = 300;

const STATUS_OPTIONS = [
  { value: "",                label: "All statuses" },
  { value: "pending_review",  label: "Payment review" },
  { value: "cash_pending",    label: "Cash pending" },
  { value: "approved",        label: "Approved" },
  { value: "rejected",        label: "Rejected" },
];

export default function MembersSearchBox({
  initialQ,
  initialStatus,
}: {
  initialQ:      string;
  initialStatus: string;
}) {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const pathname    = usePathname();
  const [q, setQ]   = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [, startTransition] = useTransition();

  // Push the latest q / status to the URL with a debounce so each
  // keystroke doesn't fire a server refetch.
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("tab", "members");
      if (q.trim()) params.set("q", q.trim()); else params.delete("q");
      if (status)   params.set("status", status); else params.delete("status");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  function clear() {
    setQ("");
    setStatus("");
  }

  return (
    <form
      method="GET"
      onSubmit={(e) => {
        // Plain-form submit still works for non-JS callers; for JS callers
        // the debounce already updated the URL, so just suppress the
        // default page-reload submit.
        e.preventDefault();
      }}
      className="flex gap-2 mb-6 flex-wrap"
    >
      <input type="hidden" name="tab" value="members" />
      <input
        type="text"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, phone, email, PIN, kids..."
        autoComplete="off"
        className="flex-1 min-w-[200px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
      />
      <select
        name="status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {(q || status) && (
        <button
          type="button"
          onClick={clear}
          className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors"
        >
          Clear
        </button>
      )}
    </form>
  );
}

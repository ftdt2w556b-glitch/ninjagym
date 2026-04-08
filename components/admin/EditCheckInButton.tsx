"use client";

import { useState } from "react";

interface Props {
  action: (formData: FormData) => Promise<void>;
  id: number;
  currentKidsCount: number;
  memberName: string;
}

export default function EditCheckInButton({ action, id, currentKidsCount, memberName }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-amber-500 hover:text-amber-700 font-semibold px-2 py-1 rounded hover:bg-amber-50 transition-colors"
      >
        Edit
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        const newCount = Number(fd.get("kids_count"));
        const diff = currentKidsCount - newCount;
        const direction = diff > 0 ? `credit back ${diff}` : diff < 0 ? `deduct ${Math.abs(diff)} more` : "no";
        const ok = confirm(
          `Change kids from ${currentKidsCount} → ${newCount} for "${memberName}"?\n` +
          `This will ${direction} session${Math.abs(diff) !== 1 ? "s" : ""} on their account.`
        );
        if (!ok) { setOpen(false); return; }
        setPending(true);
        await action(fd);
        setPending(false);
        setOpen(false);
      }}
      className="flex items-center gap-1"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="old_kids_count" value={currentKidsCount} />
      <label className="text-xs text-gray-500">Kids:</label>
      <input
        name="kids_count"
        type="number"
        min={1}
        max={20}
        defaultValue={currentKidsCount}
        className="w-12 text-xs border border-gray-300 rounded px-1 py-0.5 text-center"
        autoFocus
      />
      <button
        type="submit"
        disabled={pending}
        className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded hover:bg-amber-600 disabled:opacity-50"
      >
        {pending ? "…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-gray-400 hover:text-gray-600 px-1"
      >
        ✕
      </button>
    </form>
  );
}

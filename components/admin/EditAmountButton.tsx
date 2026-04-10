"use client";

import { useState } from "react";

interface Props {
  action: (formData: FormData) => Promise<void>;
  id: number;
  source: "member" | "cash_sale";
  currentAmount: number;
}

export default function EditAmountButton({ action, id, source, currentAmount }: Props) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-blue-500 hover:text-blue-700 font-semibold px-2 py-1 rounded hover:bg-blue-50 transition-colors"
      >
        Edit ฿
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="source" value={source} />
      <input
        type="number"
        name="amount"
        defaultValue={currentAmount}
        min="1"
        step="1"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        className="w-24 border border-blue-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="text-xs text-white bg-blue-600 hover:bg-blue-700 font-semibold px-2 py-1 rounded transition-colors"
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs text-gray-400 hover:text-gray-600 px-1 py-1 transition-colors"
      >
        ✕
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";

interface Props {
  action: (formData: FormData) => Promise<void>;
  id: number;
  current: number;
}

export default function EditNotes1kButton({ action, id, current }: Props) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        title="Edit ฿1,000 notes count"
        className={`text-xs font-mono font-semibold px-2 py-1 rounded transition-colors ${
          current > 0
            ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
            : "text-gray-300 hover:text-gray-500 hover:bg-gray-100"
        }`}
      >
        {current > 0 ? `1K×${current}` : "1K"}
      </button>
    );
  }

  return (
    <form
      action={action}
      className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 rounded-xl px-2 py-1.5"
      onSubmit={() => setEditing(false)}
    >
      <input type="hidden" name="id" value={id} />
      <span className="text-xs text-yellow-700 font-semibold mr-1">฿1K notes:</span>
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="submit"
          name="notes1k"
          value={n}
          className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
            current === n
              ? "bg-yellow-400 text-gray-900"
              : "bg-white border border-yellow-200 text-gray-700 hover:bg-yellow-100"
          }`}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs text-gray-400 hover:text-gray-600 px-1 transition-colors ml-1"
      >
        ✕
      </button>
    </form>
  );
}

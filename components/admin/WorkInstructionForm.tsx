"use client";

import { useRef } from "react";

export default function WorkInstructionForm({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="bg-white rounded-2xl shadow p-6 mb-8 border-l-4 border-[#1a56db]">
      <h2 className="font-bold text-gray-800 mb-4">Add New Topic</h2>
      <form ref={formRef} action={action} className="flex flex-col gap-3">
        <input type="hidden" name="id" value="" />
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Topic Name</label>
          <input
            name="topic_name"
            required
            placeholder="e.g. Opening Procedure, Handling Refunds"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                // Move focus to the textarea
                const textarea = formRef.current?.querySelector("textarea");
                textarea?.focus();
              }
            }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Instructions</label>
          <textarea
            name="instructions"
            required
            rows={10}
            placeholder="Write step-by-step instructions here..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db] resize-y"
          />
        </div>
        <button
          type="submit"
          className="bg-[#1a56db] text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
        >
          Save Topic
        </button>
      </form>
    </div>
  );
}

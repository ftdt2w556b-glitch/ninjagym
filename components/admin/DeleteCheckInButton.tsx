"use client";

interface Props {
  action: (formData: FormData) => Promise<void>;
  id: number;
  memberName: string;
  time: string;
}

export default function DeleteCheckInButton({ action, id, memberName, time }: Props) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete check-in for "${memberName}" at ${time}? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-xs text-red-400 hover:text-red-600 font-semibold px-2 py-1 rounded hover:bg-red-50 transition-colors"
      >
        Delete
      </button>
    </form>
  );
}

"use client";

interface Props {
  action: (formData: FormData) => Promise<void>;
  userId: string;
  userName: string;
}

export default function DeleteUserButton({ action, userId, userName }: Props) {
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`Remove "${userName}"? This cannot be undone.`)) {
            e.preventDefault();
          }
        }}
        className="text-xs bg-red-100 text-red-600 font-semibold px-3 py-1 rounded-lg hover:bg-red-200 transition-colors"
      >
        Remove
      </button>
    </form>
  );
}

"use client";

interface Props {
  action: (formData: FormData) => Promise<void>;
  id: number;
}

export default function DeleteQuestionButton({ action, id }: Props) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm("Delete this question thread?")) e.preventDefault();
        }}
        className="text-xs bg-red-100 text-red-600 font-semibold px-2.5 py-1 rounded-lg hover:bg-red-200 transition-colors"
      >
        🗑 Delete
      </button>
    </form>
  );
}

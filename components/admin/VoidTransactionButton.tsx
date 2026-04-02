"use client";

interface Props {
  action: (formData: FormData) => Promise<void>;
  id: number;
  source: "member" | "cash_sale";
  description: string;
  amount: number;
}

export default function VoidTransactionButton({ action, id, source, description, amount }: Props) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Void ฿${amount.toLocaleString()} for "${description}"? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="source" value={source} />
      <button
        type="submit"
        className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded hover:bg-red-50 transition-colors"
      >
        Void
      </button>
    </form>
  );
}

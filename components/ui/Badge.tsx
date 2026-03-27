export type BadgeVariant = "green" | "yellow" | "red" | "blue" | "gray";

const STYLES: Record<BadgeVariant, string> = {
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  gray: "bg-gray-100 text-gray-600",
};

export function slipStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "approved": return "green";
    case "rejected": return "red";
    case "cash_pending": return "blue";
    case "pending_review": return "yellow";
    default: return "gray";
  }
}

export function slipStatusLabel(status: string): string {
  switch (status) {
    case "approved": return "Approved";
    case "rejected": return "Rejected";
    case "cash_pending": return "Cash Pending";
    case "pending_review": return "Pending Review";
    default: return status;
  }
}

export default function Badge({ label, variant }: { label: string; variant: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STYLES[variant]}`}>
      {label}
    </span>
  );
}

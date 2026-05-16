/**
 * Inline "Approved by Naing · May 14, 3:42pm" line shown beside admin rows.
 * Resolves to nothing if no action has been logged yet for this target,
 * so older rows from before Chunk 3 remain clean.
 */

export default function AuditAttribution({
  audit,
}: {
  audit: { actorName: string | null; createdAt: string } | undefined;
}) {
  if (!audit) return null;
  const when = new Date(audit.createdAt).toLocaleString("en-US", {
    timeZone: "Asia/Bangkok",
    month:    "short",
    day:      "numeric",
    hour:     "numeric",
    minute:   "2-digit",
    hour12:   true,
  });
  const name = audit.actorName?.trim() || "Unknown staff";
  return (
    <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
      <span className="font-semibold text-gray-500">{name}</span>
      <span className="mx-1.5">·</span>
      {when}
    </p>
  );
}

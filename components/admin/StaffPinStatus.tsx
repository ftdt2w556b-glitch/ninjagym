"use client";

import { useEffect, useState } from "react";
import { useStaffPin } from "@/components/admin/StaffPinProvider";

/**
 * Header chip showing whose PIN is currently authorising dashboard writes
 * and how much time is left before the next write re-prompts the modal.
 *
 *   🔐 Naing · 12 min left
 *
 * Hidden when no write cookie is active — admin/owner sessions bypass the
 * modal entirely so nothing renders for them. Updates the minute counter
 * once a minute so it ticks down without re-rendering the whole tree.
 */
export default function StaffPinStatus() {
  const { writeStatus } = useStaffPin();
  const [now, setNow]   = useState(() => Date.now());

  // Tick once per minute so the displayed countdown stays fresh.
  useEffect(() => {
    if (!writeStatus) return;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [writeStatus]);

  if (!writeStatus) return null;

  const msLeft  = writeStatus.expiresAt.getTime() - now;
  if (msLeft <= 0) return null;
  const minLeft = Math.max(1, Math.ceil(msLeft / 60_000));

  return (
    <span
      className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-[#1a56db] border border-blue-200"
      title={`PIN authorisation expires at ${writeStatus.expiresAt.toLocaleTimeString("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", minute: "2-digit", hour12: true })}`}
    >
      🔐 {writeStatus.actorName}
      <span className="text-blue-400">·</span>
      <span>{minLeft} min</span>
    </span>
  );
}

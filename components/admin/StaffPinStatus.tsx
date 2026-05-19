"use client";

import { useEffect, useState } from "react";
import { useStaffPin } from "@/components/admin/StaffPinProvider";

/**
 * Header chip showing whose PIN is currently authorising dashboard writes
 * and how much time is left before the next write re-prompts the modal.
 *
 *   🔐 Naing · 12 min       (active window, click to renew or swap)
 *   🔒 Sign in PIN          (no active window, click to start one)
 *
 * Hidden on tiny screens (sm:) to keep mobile header tight. Admin/owner
 * sessions bypass PIN entirely and so writeStatus stays null for them ,
 * for them the chip shows 'Sign in PIN' but tapping it just opens the
 * modal which their session can still use to act as a non-admin staff
 * actor (useful when admin is at the centre and wants attribution to
 * Naing/Win on a particular action).
 *
 * Click flows:
 *   • Active chip + same staff retypes → window resets to 15 min
 *   • Active chip + different staff PIN → cookie swaps to new actor
 *     (clean handover, next write attributes to the new staff)
 *   • Inactive chip + any PIN → window starts fresh
 */
export default function StaffPinStatus() {
  const { writeStatus, openPinModal } = useStaffPin();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!writeStatus) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [writeStatus]);

  const msLeft  = writeStatus ? writeStatus.expiresAt.getTime() - now : 0;
  const minLeft = writeStatus ? Math.max(1, Math.ceil(msLeft / 60_000)) : 0;
  const isActive = !!writeStatus && msLeft > 0;

  return (
    <button
      type="button"
      onClick={() => { void openPinModal(); }}
      title={isActive
        ? `PIN authorisation expires at ${writeStatus!.expiresAt.toLocaleTimeString("en-US", { timeZone: "Asia/Bangkok", hour: "numeric", minute: "2-digit", hour12: true })}. Click to renew or swap staff.`
        : "No active PIN. Click to sign in."
      }
      className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
        isActive
          ? "bg-blue-50 text-[#1a56db] border-blue-200 hover:bg-blue-100"
          : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
      }`}
    >
      {isActive ? (
        <>
          🔐 {writeStatus!.actorName}
          <span className="text-blue-400">·</span>
          <span>{minLeft} min</span>
        </>
      ) : (
        <>🔒 Sign in PIN</>
      )}
    </button>
  );
}

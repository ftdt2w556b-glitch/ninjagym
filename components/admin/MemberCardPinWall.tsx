"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

/**
 * Server-side gate landing page for /qr/card/[id]?from=admin when the
 * logged-in staff session doesn't have a fresh PIN write cookie.
 *
 * On mount, it triggers a GET /api/staff-pin/check-write. The dashboard
 * StaffPinProvider's fetchWithPin would normally handle this, but this
 * page is rendered on the public /qr route OUTSIDE the admin layout ,
 * so we hit the endpoint directly and reload on success.
 *
 * The endpoint returns 401 + code:pin_required when there's no valid
 * cookie. We don't open a modal here (this page isn't inside the
 * provider); instead we bounce the user back to /admin/members where
 * they can tap Reveal on the row to authenticate, then come back.
 */
export default function MemberCardPinWall() {
  const triedRef = useRef(false);

  useEffect(() => {
    if (triedRef.current) return;
    triedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/staff-pin/check-write", { method: "GET" });
        if (res.ok) window.location.reload();
      } catch {
        /* network blip, user can hit Try Again */
      }
    })();
  }, []);

  async function tryAgain() {
    try {
      const res = await fetch("/api/staff-pin/check-write", { method: "GET" });
      if (res.ok) window.location.reload();
    } catch { /* leave the wall up */ }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#1a3a6e] to-[#0f1e3a] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 text-center">
        <p className="text-3xl mb-3">🔐</p>
        <h2 className="font-bold text-gray-900 text-lg mb-1">PIN required</h2>
        <p className="text-sm text-gray-500 mb-5">
          Member details are locked. Approve or reveal anything on the dashboard
          first to unlock the PIN window, then come back.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/admin/members"
            className="bg-[#1a56db] hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
          >
            Back to Members
          </Link>
          <button
            type="button"
            onClick={tryAgain}
            className="text-sm font-semibold text-gray-500 hover:text-gray-700 py-2"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

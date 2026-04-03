"use client";

import { useState } from "react";

type SlipStatus = "pending_review" | "cash_pending" | "approved" | "rejected";

const STATUS_LABEL: Record<SlipStatus, string> = {
  pending_review: "Pending Review",
  cash_pending:   "Cash Pending",
  approved:       "Approved",
  rejected:       "Rejected",
};

const STATUS_BADGE: Record<SlipStatus, string> = {
  pending_review: "bg-yellow-100 text-yellow-700",
  cash_pending:   "bg-orange-100 text-orange-700",
  approved:       "bg-green-100 text-green-700",
  rejected:       "bg-red-100 text-red-600",
};

export default function PaymentActions({
  id,
  recordType,
  initialStatus,
  qrHref,
  memberName,
  userRole,
}: {
  id: number;
  recordType: "member" | "event" | "shop";
  initialStatus: SlipStatus;
  qrHref?: string;
  memberName?: string;
  userRole?: string;
}) {
  const canApprove     = ["admin", "manager", "staff", "owner"].includes(userRole ?? "");
  const canManage      = ["admin", "manager"].includes(userRole ?? ""); // undo/restore only
  const canApproveCash = canApprove;
  const [status, setStatus]         = useState<SlipStatus>(initialStatus);
  const [busy, setBusy]             = useState<string | null>(null);
  const [err, setErr]               = useState<string | null>(null);
  const [confirmCashApprove, setConfirmCashApprove]       = useState(false);
  const [confirmWrongProgram, setConfirmWrongProgram]     = useState(false);

  async function doAction(action: string, nextStatus: SlipStatus, notes?: string) {
    setBusy(action);
    setErr(null);
    const prev = status;
    setStatus(nextStatus); // optimistic

    try {
      const fd = new FormData();
      fd.set("id", String(id));
      fd.set("action", action);
      fd.set("type", recordType);
      if (notes) fd.set("notes", notes);
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { accept: "application/json" },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      setStatus(prev); // revert
      setErr("Action failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const isPending  = status === "pending_review" || status === "cash_pending";
  const isApproved = status === "approved";
  const isRejected = status === "rejected";

  return (
    <div>
      {/* Live status badge */}
      <div className="mb-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[status]}`}>
          {busy && (
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          )}
          {STATUS_LABEL[status]}
        </span>
      </div>

      {err && <p className="text-xs text-red-500 mb-2">{err}</p>}

      <div className="flex gap-2 flex-wrap">
        {/* Approve/Reject — available to all staff and above */}
        {isPending && canApprove && (status !== "cash_pending" || canApproveCash) && !confirmCashApprove && !confirmWrongProgram && (
          <>
            <button
              onClick={() => {
                if (status === "cash_pending") {
                  setConfirmCashApprove(true);
                } else {
                  doAction("approve", "approved");
                }
              }}
              disabled={!!busy}
              className="bg-green-500 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              ✓ Approve
            </button>
            <button
              onClick={() => doAction("reject", "rejected")}
              disabled={!!busy}
              className="bg-red-100 text-red-600 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-red-200 disabled:opacity-50 transition-colors"
            >
              ✕ Reject
            </button>
            {/* Wrong Program — admin/manager only, members only */}
            {canManage && recordType === "member" && (
              <button
                onClick={() => setConfirmWrongProgram(true)}
                disabled={!!busy}
                className="bg-orange-100 text-orange-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-orange-200 disabled:opacity-50 transition-colors"
              >
                ⚠️ Wrong Program
              </button>
            )}
          </>
        )}

        {/* Wrong Program confirmation */}
        {confirmWrongProgram && (
          <div className="w-full bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-orange-800 mb-1">⚠️ Wrong program selected?</p>
            <p className="text-xs text-orange-700 mb-3">
              This rejects the program but keeps the member card active. The parent will be prompted to re-register with the correct program.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setConfirmWrongProgram(false);
                  doAction("reject", "rejected", "Wrong program selected — please re-register with the correct program from your member card.");
                }}
                disabled={!!busy}
                className="bg-orange-500 text-white font-semibold text-xs px-4 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                Reject Program
              </button>
              <button
                onClick={() => setConfirmWrongProgram(false)}
                className="bg-white text-gray-600 font-semibold text-xs px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Admin/manager: cash approval confirmation */}
        {confirmCashApprove && (
          <div className="w-full bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-orange-800 mb-1">⚠️ Cash payment: not collected at POS</p>
            <p className="text-xs text-orange-700 mb-3">
              Approving here will not record a cash sale in the drawer. Only approve if you have confirmed payment by other means.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setConfirmCashApprove(false); doAction("approve", "approved"); }}
                disabled={!!busy}
                className="bg-orange-500 text-white font-semibold text-xs px-4 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                Approve anyway
              </button>
              <button
                onClick={() => setConfirmCashApprove(false)}
                className="bg-white text-gray-600 font-semibold text-xs px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {canManage && (isApproved || isRejected) && (
          <button
            onClick={() => { doAction("restore", "pending_review"); }}
            disabled={!!busy}
            className="bg-yellow-100 text-yellow-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-yellow-200 disabled:opacity-50 transition-colors"
          >
            ↩ {isRejected ? "Restore to Pending" : "Undo Approval"}
          </button>
        )}

        {qrHref && (
          <a
            href={qrHref}
            className="bg-blue-50 text-[#1a56db] font-semibold text-sm px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors"
          >
            View Member Card
          </a>
        )}
      </div>

    </div>
  );
}

"use client";
export default function PrintButton() {
  return (
    <button className="print-btn no-print" onClick={() => window.print()}>
      Print Receipt
    </button>
  );
}

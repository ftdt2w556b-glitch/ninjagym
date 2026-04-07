"use client";
export default function PrintAllButton() {
  return (
    <button className="print-btn" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}

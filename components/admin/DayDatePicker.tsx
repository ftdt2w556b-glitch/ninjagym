"use client";

import { useEffect } from "react";

/**
 * Tiny client component that attaches an onChange listener to the
 * server-rendered <input type="date" data-day-picker /> element,
 * navigating to the selected date when changed.
 */
export default function DayDatePicker() {
  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>("input[data-day-picker]");
    if (!input) return;

    function handleChange(e: Event) {
      const val = (e.target as HTMLInputElement).value;
      if (val) {
        const url = new URL(window.location.href);
        url.searchParams.set("period", "day");
        url.searchParams.set("date", val);
        window.location.href = url.toString();
      }
    }

    input.addEventListener("change", handleChange);
    return () => input.removeEventListener("change", handleChange);
  }, []);

  return null;
}

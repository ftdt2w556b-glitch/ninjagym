"use client";

import { useEffect } from "react";

/**
 * Attaches onChange listeners to all server-rendered period picker inputs
 * (data-period-picker="day|month") so selecting a date/month navigates.
 */
export default function PeriodPicker() {
  useEffect(() => {
    const inputs = document.querySelectorAll<HTMLInputElement>("input[data-period-picker]");

    function handleChange(e: Event) {
      const input = e.target as HTMLInputElement;
      const period = input.dataset.periodPicker; // "day" or "month"
      const val = input.value;
      if (val && period) {
        const url = new URL(window.location.href);
        url.searchParams.set("period", period);
        url.searchParams.set("date", val);
        window.location.href = url.toString();
      }
    }

    inputs.forEach((input) => input.addEventListener("change", handleChange));
    return () => inputs.forEach((input) => input.removeEventListener("change", handleChange));
  }, []);

  return null;
}

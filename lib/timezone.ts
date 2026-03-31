/**
 * Bangkok timezone utilities (Asia/Bangkok = UTC+7)
 * All dates stored in DB as UTC — use these for display and "today" calculations.
 */

const TZ = "Asia/Bangkok";

/** Returns today's date string in Bangkok time: "YYYY-MM-DD" */
export function bangkokToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ }); // en-CA → YYYY-MM-DD
}

/** Formats a UTC date string for Bangkok display */
export function formatBangkokDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
): string {
  return new Date(dateStr).toLocaleDateString("en-US", { timeZone: TZ, ...options });
}

/** Formats a UTC date string as Bangkok time */
export function formatBangkokTime(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }
): string {
  return new Date(dateStr).toLocaleTimeString("en-GB", { timeZone: TZ, ...options });
}

/** Returns Bangkok start-of-day (midnight) ISO string for use in DB range queries */
export function bangkokStartOfDay(dateStr?: string): string {
  const d = dateStr ?? bangkokToday();
  return `${d}T00:00:00+07:00`;
}

/** Returns Bangkok end-of-day ISO string for use in DB range queries */
export function bangkokEndOfDay(dateStr?: string): string {
  const d = dateStr ?? bangkokToday();
  return `${d}T23:59:59+07:00`;
}

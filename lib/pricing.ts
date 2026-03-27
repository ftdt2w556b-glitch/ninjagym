import { MembershipType } from "@/types";

export const MEMBERSHIP_TYPES: MembershipType[] = [
  // Single sessions (per kid)
  { id: "climb_unguided", label: "Unguided Climb", perKid: true },
  { id: "session_group", label: "Group Session", perKid: true },
  { id: "session_1to1", label: "1-to-1 Session", perKid: true },
  { id: "day_camp", label: "Day Camp", perKid: true },
  { id: "combo_game_train", label: "Combo Game + Train", perKid: true },
  { id: "all_day", label: "All Day", perKid: true },
  // Monthly
  { id: "monthly_2hr", label: "Monthly 2hr Pass", perKid: false },
  { id: "monthly_5hr", label: "Monthly 5hr Pass", perKid: false },
  // Group Session Cards
  { id: "sessions_4", label: "4-Session Card", perKid: false },
  { id: "sessions_8", label: "8-Session Card", perKid: false },
  { id: "sessions_16", label: "16-Session Card", perKid: false },
  { id: "sessions_20", label: "20-Session Card", perKid: false },
  // Day Camp Cards
  { id: "day_camp_4", label: "4-Day Camp Card", perKid: false },
  { id: "day_camp_8", label: "8-Day Camp Card", perKid: false },
  { id: "day_camp_16", label: "16-Day Camp Card", perKid: false },
  { id: "day_camp_20", label: "20-Day Camp Card", perKid: false },
  // 1-to-1 Cards
  { id: "sessions_1to1_4", label: "4x 1-to-1 Card", perKid: false },
  { id: "sessions_1to1_8", label: "8x 1-to-1 Card", perKid: false },
  { id: "sessions_1to1_16", label: "16x 1-to-1 Card", perKid: false },
  { id: "sessions_1to1_20", label: "20x 1-to-1 Card", perKid: false },
  // All Day Cards
  { id: "all_day_4", label: "4x All Day Card", perKid: false },
  { id: "all_day_8", label: "8x All Day Card", perKid: false },
  { id: "all_day_16", label: "16x All Day Card", perKid: false },
  { id: "all_day_20", label: "20x All Day Card", perKid: false },
  // Combo Cards
  { id: "combo_4", label: "4x Combo Card", perKid: false },
  { id: "combo_8", label: "8x Combo Card", perKid: false },
  { id: "combo_16", label: "16x Combo Card", perKid: false },
  { id: "combo_20", label: "20x Combo Card", perKid: false },
];

// Static price map (mirrors Supabase settings table)
const BASE_PRICES: Record<string, number> = {
  price_climb_unguided: 250,
  price_session_group: 350,
  price_session_1to1: 600,
  price_day_camp: 450,
  price_combo_game_train: 400,
  price_all_day: 500,
  price_monthly_2hr: 2500,
  price_monthly_5hr: 5500,
  price_sessions_4: 1200,
  price_sessions_8: 2200,
  price_sessions_16: 4000,
  price_sessions_20: 4800,
  price_day_camp_4: 1600,
  price_day_camp_8: 3000,
  price_day_camp_16: 5600,
  price_day_camp_20: 6800,
  price_sessions_1to1_4: 2200,
  price_sessions_1to1_8: 4200,
  price_sessions_1to1_16: 8000,
  price_sessions_1to1_20: 9600,
  price_all_day_4: 1800,
  price_all_day_8: 3400,
  price_all_day_16: 6400,
  price_all_day_20: 7800,
  price_combo_4: 1400,
  price_combo_8: 2600,
  price_combo_16: 4800,
  price_combo_20: 5800,
  birthday_rate_morning: 3000,
  birthday_rate_afternoon: 5000,
  birthday_rate_evening: 3000,
  birthday_rate_weekend: 5000,
  birthday_extra_6_10: 500,
  birthday_extra_11_15: 1000,
  birthday_extra_16_20: 1500,
};

/**
 * Get total price for a membership type.
 * perKid types are multiplied by kidsCount.
 * Card/monthly types are flat.
 */
export function getPriceForType(
  type: string,
  kidsCount: number = 1,
  settingsOverride?: Record<string, number>
): number {
  const prices = settingsOverride ?? BASE_PRICES;
  const baseKey = `price_${type}`;
  const base = prices[baseKey] ?? 0;
  const membershipType = MEMBERSHIP_TYPES.find((m) => m.id === type);
  if (!membershipType) return base;
  return membershipType.perKid ? base * Math.max(1, kidsCount) : base;
}

export type BirthdayTimeSlot = "morning" | "afternoon" | "evening" | "weekend";

/**
 * Calculate birthday/event booking amount.
 * First 5 kids included; extras charged in bands.
 */
export function getBirthdayAmount(
  timeSlot: BirthdayTimeSlot,
  numHours: number,
  numKids: number,
  settingsOverride?: Record<string, number>
): number {
  const prices = settingsOverride ?? BASE_PRICES;
  const rateKey = `birthday_rate_${timeSlot}`;
  const rate = prices[rateKey] ?? 0;
  let extra = 0;
  if (numKids >= 16) {
    extra = prices["birthday_extra_16_20"] ?? 1500;
  } else if (numKids >= 11) {
    extra = prices["birthday_extra_11_15"] ?? 1000;
  } else if (numKids >= 6) {
    extra = prices["birthday_extra_6_10"] ?? 500;
  }
  return rate * numHours + extra;
}

/** Format a number as Thai baht: "7,000 THB" */
export function formatTHB(amount: number): string {
  return `${amount.toLocaleString("en-US")} THB`;
}

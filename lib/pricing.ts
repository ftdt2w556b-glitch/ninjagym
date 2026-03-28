import { MembershipType } from "@/types";

export const MEMBERSHIP_TYPES: MembershipType[] = [
  // Single sessions (per kid)
  { id: "climb_unguided",   label: "Unguided Climb Zone (20 min)",  perKid: true,  note: "Self-guided climb zone access for 20 minutes. No instructor." },
  { id: "session_group",    label: "Group Guide Session",            perKid: true,  note: "50-min guided group session with an instructor. Suitable for all levels." },
  { id: "session_1to1",     label: "1-to-1 Private Session",        perKid: true,  note: "50-min private session with dedicated instructor. Best for focused skill building." },
  { id: "day_camp",         label: "Day Camp (10am–2pm)",           perKid: true,  note: "4-hour supervised day camp. Drop-in before 3pm. Includes climbing, parkour and ninja training." },
  { id: "combo_game_train", label: "Combo Game & Train (2 hrs)",    perKid: true,  note: "2-hour session combining a guided training session with game room access." },
  { id: "all_day",          label: "All Day (max 8 hrs)",           perKid: true,  note: "Full day access up to 8 hours. Best value for a full day of ninja training." },
  // Monthly
  { id: "monthly_2hr",      label: "Monthly Flex — 2 Hrs Any Day", perKid: false, note: "Monthly membership: 2 hours of access any day. Ideal for regular visitors." },
  { id: "monthly_5hr",      label: "Monthly Flex — 5 Hrs Any Day", perKid: false, note: "Monthly membership: 5 hours of access any day. Best value for frequent visitors." },
  // Group Session Cards
  { id: "sessions_4",       label: "Group 4-Card (5% off)",        perKid: false, note: "4 group sessions shared across your kids. 5% discount applied." },
  { id: "sessions_8",       label: "Group 8-Card (10% off)",       perKid: false, note: "8 group sessions shared across your kids. 10% discount applied." },
  { id: "sessions_16",      label: "Group 16-Card (15% off)",      perKid: false, note: "16 group sessions shared across your kids. 15% discount applied." },
  { id: "sessions_20",      label: "Group 20-Card (20% off)",      perKid: false, note: "20 group sessions shared across your kids. 20% discount applied." },
  // Day Camp Cards
  { id: "day_camp_4",       label: "Day Camp 4-Card (5% off)",     perKid: false, note: "4 day camp sessions. Cards are shared across kids in your family. 5% discount." },
  { id: "day_camp_8",       label: "Day Camp 8-Card (10% off)",    perKid: false, note: "8 day camp sessions. Shared across kids. 10% discount." },
  { id: "day_camp_16",      label: "Day Camp 16-Card (15% off)",   perKid: false, note: "16 day camp sessions. Shared across kids. 15% discount." },
  { id: "day_camp_20",      label: "Day Camp 20-Card (20% off)",   perKid: false, note: "20 day camp sessions. Shared across kids. 20% discount." },
  // 1-to-1 Cards
  { id: "sessions_1to1_4",  label: "1-to-1 4-Card (5% off)",      perKid: false, note: "4 private 1-to-1 sessions. 5% discount applied." },
  { id: "sessions_1to1_8",  label: "1-to-1 8-Card (10% off)",     perKid: false, note: "8 private 1-to-1 sessions. 10% discount applied." },
  { id: "sessions_1to1_16", label: "1-to-1 16-Card (15% off)",    perKid: false, note: "16 private 1-to-1 sessions. 15% discount applied." },
  { id: "sessions_1to1_20", label: "1-to-1 20-Card (20% off)",    perKid: false, note: "20 private 1-to-1 sessions. 20% discount applied." },
  // All Day Cards
  { id: "all_day_4",        label: "All Day 4-Card (5% off)",      perKid: false, note: "4 all-day passes. 5% discount applied." },
  { id: "all_day_8",        label: "All Day 8-Card (10% off)",     perKid: false, note: "8 all-day passes. 10% discount applied." },
  { id: "all_day_16",       label: "All Day 16-Card (15% off)",    perKid: false, note: "16 all-day passes. 15% discount applied." },
  { id: "all_day_20",       label: "All Day 20-Card (20% off)",    perKid: false, note: "20 all-day passes. 20% discount applied." },
  // Combo Cards
  { id: "combo_4",          label: "Combo 4-Card (5% off)",        perKid: false, note: "4 combo sessions (train + game room). 5% discount." },
  { id: "combo_8",          label: "Combo 8-Card (10% off)",       perKid: false, note: "8 combo sessions (train + game room). 10% discount." },
  { id: "combo_16",         label: "Combo 16-Card (15% off)",      perKid: false, note: "16 combo sessions (train + game room). 15% discount." },
  { id: "combo_20",         label: "Combo 20-Card (20% off)",      perKid: false, note: "20 combo sessions (train + game room). 20% discount." },
];

// Static price map — mirrors Supabase settings table
// These are the REAL prices from dojo.ninjagym.com
export const BASE_PRICES: Record<string, number> = {
  price_climb_unguided:    200,
  price_session_group:     350,
  price_session_1to1:      500,
  price_day_camp:          555,
  price_combo_game_train:  550,
  price_all_day:           1000,
  price_monthly_2hr:       9500,
  price_monthly_5hr:       17500,
  price_sessions_4:        1350,
  price_sessions_8:        2700,
  price_sessions_16:       5300,
  price_sessions_20:       6500,
  price_day_camp_4:        2109,
  price_day_camp_8:        3996,
  price_day_camp_16:       7548,
  price_day_camp_20:       8880,
  price_sessions_1to1_4:   1900,
  price_sessions_1to1_8:   3600,
  price_sessions_1to1_16:  6800,
  price_sessions_1to1_20:  8000,
  price_all_day_4:         3800,
  price_all_day_8:         7200,
  price_all_day_16:        13600,
  price_all_day_20:        16000,
  price_combo_4:           2090,
  price_combo_8:           3960,
  price_combo_16:          7480,
  price_combo_20:          8800,
  birthday_rate_morning:   3000,
  birthday_rate_afternoon: 5000,
  birthday_rate_evening:   3000,
  birthday_rate_weekend:   5000,
  birthday_extra_6_10:     500,
  birthday_extra_11_15:    1000,
  birthday_extra_16_20:    1500,
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

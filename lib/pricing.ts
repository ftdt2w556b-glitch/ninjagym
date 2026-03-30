import { MembershipType } from "@/types";

export const MEMBERSHIP_TYPES: MembershipType[] = [
  // ── Single sessions (per kid) ──────────────────────────────
  { id: "climb_unguided",   label: "Unguided Climb Zone (20 min)", perKid: true,  note: "Self-guided climb zone access for 20 minutes. No Guide required." },
  { id: "session_group",    label: "Group Session",                perKid: true,  note: "50-min guided group session with a Guide. Suitable for all levels." },
  { id: "session_1to1",     label: "1-to-1 Private Session",       perKid: true,  note: "50-min private session with a dedicated Guide. Best for focused skill building." },
  { id: "day_camp",         label: "Day Camp (10am–2pm)",          perKid: true,  note: "4-hour supervised day camp. Drop-in before 3pm. Includes climbing, parkour and ninja training." },
  { id: "combo_game_train", label: "Combo Game & Train (2 hrs)",   perKid: true,  note: "2-hour session combining a guided training session with game room access." },
  { id: "all_day",          label: "All Day (max 8 hrs)",          perKid: true,  note: "Full day access up to 8 hours. Best value for a full day of ninja training." },
  { id: "birthday_event", label: "Birthday / Event Guest", perKid: false, note: "Registered via a birthday or group event booking." },
  // ── Monthly ────────────────────────────────────────────────
  { id: "monthly_flex",     label: "Monthly Flex: any day or time", perKid: false, timeBased: true, note: "Unlimited access for 30 days from approval. Scan in anytime — no booking needed. Great for regulars." },
  // ── Bulk session packs (sliding discount) ──────────────────
  { id: "group_bulk",   label: "Group Sessions (bulk)",    perKid: false, bulk: true, bulkBase: "price_session_group",    note: "Buy 2–20 sessions upfront. 1% off per session — buy 10, save 10%. Max 20% off." },
  { id: "daycamp_bulk", label: "Day Camp Sessions (bulk)", perKid: false, bulk: true, bulkBase: "price_day_camp",         note: "Buy 2–20 day camp sessions upfront. 1% off per session purchased. Max 20% off." },
  { id: "1to1_bulk",    label: "1-to-1 Sessions (bulk)",   perKid: false, bulk: true, bulkBase: "price_session_1to1",     note: "Buy 2–20 private sessions upfront. 1% off per session purchased. Max 20% off." },
  { id: "allday_bulk",  label: "All Day Passes (bulk)",    perKid: false, bulk: true, bulkBase: "price_all_day",          note: "Buy 2–20 all-day passes upfront. 1% off per session purchased. Max 20% off." },
  { id: "combo_bulk",   label: "Combo Sessions (bulk)",    perKid: false, bulk: true, bulkBase: "price_combo_game_train", note: "Buy 2–20 combo sessions upfront. 1% off per session purchased. Max 20% off." },
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
  price_monthly_flex:      6000,

  // Birthday / event booking rates (THB per hour)
  birthday_rate_morning:   3000,
  birthday_rate_afternoon: 5000,
  birthday_rate_evening:   3000,
  birthday_rate_weekend:   5000,

  // Birthday extra kids surcharge (flat fee per booking)
  birthday_extra_6_10:     500,
  birthday_extra_11_15:    1000,
  birthday_extra_16_20:    1500,
};

/**
 * Get total price for a single / monthly membership type.
 * perKid types are multiplied by kidsCount.
 * For bulk types use calcBulkPrice() instead.
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

/**
 * Calculate the total price for a bulk session purchase.
 * Discount = 1% per session, capped at 20%.
 * e.g. 5 sessions = 5% off, 10 = 10% off, 20 = 20% off.
 */
export function calcBulkPrice(
  basePrice: number,
  qty: number,
  settingsOverride?: Record<string, number>
): number {
  const price = settingsOverride ? (settingsOverride[`price_${qty}`] ?? basePrice) : basePrice;
  const discount = Math.min(qty, 20) / 100;
  return Math.round(price * qty * (1 - discount));
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

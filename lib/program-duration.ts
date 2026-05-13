/**
 * Maps a check-in's membership_type to a session duration for the Timers tab.
 *
 * Two shapes:
 *   - { kind: "minutes", minutes }    , counts down from check_in_at + minutes
 *   - { kind: "endTime", hour, minute }, counts down to today's HH:MM (Bangkok)
 *
 * Returns null when no auto-timer applies (all_day, allday_bulk, birthday_event,
 * unknown types). Birthday timers are handled via the custom timer input, rare
 * enough that staff just type a name + minutes.
 */

export type ProgramDuration =
  | { kind: "minutes"; minutes: number }
  | { kind: "endTime"; hour: number; minute: number };

const MINUTES: Record<string, number> = {
  climb_unguided:       20,
  session_group:        55,
  session_1to1:         55,
  free_session_loyalty: 55,
  group_bulk:           55,
  "1to1_bulk":          55,
  combo_game_train:     120,
  combo_bulk:           120,
  monthly_flex:         60,
};

const DAY_CAMP_TYPES = new Set(["day_camp", "daycamp_bulk"]);

const NO_TIMER = new Set([
  "all_day",
  "allday_bulk",
  "birthday_event",
]);

export function getProgramDuration(
  membershipType: string | null | undefined,
  daycampEndTime: string = "14:00"
): ProgramDuration | null {
  if (!membershipType) return null;
  if (NO_TIMER.has(membershipType)) return null;

  if (DAY_CAMP_TYPES.has(membershipType)) {
    const [h, m] = daycampEndTime.split(":").map((n) => parseInt(n, 10));
    if (isNaN(h) || isNaN(m)) return { kind: "endTime", hour: 14, minute: 0 };
    return { kind: "endTime", hour: h, minute: m };
  }

  const mins = MINUTES[membershipType];
  return mins ? { kind: "minutes", minutes: mins } : null;
}

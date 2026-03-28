-- Seed / upsert all pricing settings into the settings table.
-- Run this in Supabase SQL Editor.

INSERT INTO settings (key, value, label) VALUES
  -- Single sessions
  ('price_climb_unguided',    '200',   'Unguided Climb Zone (20 min)'),
  ('price_session_group',     '350',   'Group Guide Session'),
  ('price_session_1to1',      '500',   '1-to-1 Private Session'),
  ('price_day_camp',          '555',   'Day Camp (10am–2pm) per kid'),
  ('price_combo_game_train',  '550',   'Combo Game & Train (2 hrs)'),
  ('price_all_day',           '1000',  'All Day (max 8 hrs)'),
  -- Monthly
  ('price_monthly_2hr',       '9500',  'Monthly Flex — 2 Hrs Any Day'),
  ('price_monthly_5hr',       '17500', 'Monthly Flex — 5 Hrs Any Day'),
  -- Group session cards
  ('price_sessions_4',        '1350',  'Group 4-Card'),
  ('price_sessions_8',        '2700',  'Group 8-Card'),
  ('price_sessions_16',       '5300',  'Group 16-Card'),
  ('price_sessions_20',       '6500',  'Group 20-Card'),
  -- Day camp cards
  ('price_day_camp_4',        '2109',  'Day Camp 4-Card'),
  ('price_day_camp_8',        '3996',  'Day Camp 8-Card'),
  ('price_day_camp_16',       '7548',  'Day Camp 16-Card'),
  ('price_day_camp_20',       '8880',  'Day Camp 20-Card'),
  -- 1-to-1 cards
  ('price_sessions_1to1_4',   '1900',  '1-to-1 4-Card'),
  ('price_sessions_1to1_8',   '3600',  '1-to-1 8-Card'),
  ('price_sessions_1to1_16',  '6800',  '1-to-1 16-Card'),
  ('price_sessions_1to1_20',  '8000',  '1-to-1 20-Card'),
  -- All day cards
  ('price_all_day_4',         '3800',  'All Day 4-Card'),
  ('price_all_day_8',         '7200',  'All Day 8-Card'),
  ('price_all_day_16',        '13600', 'All Day 16-Card'),
  ('price_all_day_20',        '16000', 'All Day 20-Card'),
  -- Combo cards
  ('price_combo_4',           '2090',  'Combo 4-Card'),
  ('price_combo_8',           '3960',  'Combo 8-Card'),
  ('price_combo_16',          '7480',  'Combo 16-Card'),
  ('price_combo_20',          '8800',  'Combo 20-Card'),
  -- Birthday / event rates
  ('birthday_rate_morning',   '3000',  'Birthday Morning Rate (per hour)'),
  ('birthday_rate_afternoon', '5000',  'Birthday Afternoon Rate (per hour)'),
  ('birthday_rate_evening',   '3000',  'Birthday Evening Rate (per hour)'),
  ('birthday_rate_weekend',   '5000',  'Birthday Weekend Rate (per hour)'),
  ('birthday_extra_6_10',     '500',   'Birthday Extra Kids 6–10'),
  ('birthday_extra_11_15',    '1000',  'Birthday Extra Kids 11–15'),
  ('birthday_extra_16_20',    '1500',  'Birthday Extra Kids 16–20')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      label = EXCLUDED.label;

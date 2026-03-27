-- ============================================================
-- NinjaGym Initial Schema Migration
-- Run in Supabase SQL Editor in order
-- ============================================================

-- -------------------------------------------------------
-- 1. profiles (extends Supabase Auth users)
-- -------------------------------------------------------
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  email text,
  role text not null default 'staff', -- 'admin' | 'staff' | 'owner'
  pin text, -- 4-digit PIN hashed with bcrypt, used on /admin/pos tablet login
  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- Allow users to read their own profile
create policy "Users can read own profile" on profiles
  for select using (auth.uid() = id);

-- Admins can manage all profiles
create policy "Admins can manage profiles" on profiles
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Trigger: auto-create profile on new user signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'staff');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- -------------------------------------------------------
-- 2. member_registrations
-- -------------------------------------------------------
create table member_registrations (
  id bigserial primary key,
  name text not null,
  phone text,
  email text,
  kids_names text,
  kids_count int default 1,
  membership_type varchar(50) not null,
  sessions_remaining int,
  payment_method varchar(20) default 'promptpay', -- 'promptpay' | 'cash' | 'stripe'
  amount_paid numeric(10,2),
  slip_image text, -- Supabase Storage path
  slip_status varchar(30) default 'pending_review',
  -- Values: pending_review | cash_pending | approved | rejected
  slip_uploaded_at timestamptz,
  slip_reviewed_at timestamptz,
  slip_notes text,
  notes text,
  registered_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table member_registrations enable row level security;

-- Public can insert (self-registration)
create policy "Anyone can register" on member_registrations
  for insert with check (true);

-- Staff/admin/owner can read
create policy "Staff can read members" on member_registrations
  for select using (
    exists (select 1 from profiles where id = auth.uid())
  );

-- Staff/admin can update
create policy "Staff can update members" on member_registrations
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'staff'))
  );

-- Only admin can delete
create policy "Admin can delete members" on member_registrations
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- -------------------------------------------------------
-- 3. attendance_logs
-- -------------------------------------------------------
create table attendance_logs (
  id bigserial primary key,
  member_id bigint references member_registrations(id),
  member_name text,
  member_email text,
  check_in_at timestamptz default now(),
  checked_in_by uuid references profiles(id), -- null if self-scan
  notes text
);

alter table attendance_logs enable row level security;

create policy "Anyone can insert attendance" on attendance_logs
  for insert with check (true);

create policy "Staff can read attendance" on attendance_logs
  for select using (
    exists (select 1 from profiles where id = auth.uid())
  );

-- -------------------------------------------------------
-- 4. event_bookings (birthdays / events)
-- -------------------------------------------------------
create table event_bookings (
  id bigserial primary key,
  name text not null,
  phone text,
  email text,
  event_date date not null,
  time_slot varchar(30) not null, -- 'morning' | 'afternoon' | 'evening' | 'weekend'
  hours varchar(50), -- freetext display e.g. "7pm-9pm"
  num_hours numeric(4,1), -- numeric for price calc e.g. 2.0
  num_kids int default 1,
  birthday_child_name text,
  birthday_child_age int,
  payment_method varchar(20) default 'promptpay',
  amount_paid numeric(10,2),
  slip_image text,
  slip_status varchar(30) default 'pending_review',
  -- Values: pending_review | cash_pending | approved | rejected
  slip_uploaded_at timestamptz,
  slip_reviewed_at timestamptz,
  slip_notes text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table event_bookings enable row level security;

create policy "Anyone can book event" on event_bookings
  for insert with check (true);

create policy "Staff can read event bookings" on event_bookings
  for select using (
    exists (select 1 from profiles where id = auth.uid())
  );

create policy "Staff can update event bookings" on event_bookings
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'staff'))
  );

create policy "Admin can delete event bookings" on event_bookings
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- -------------------------------------------------------
-- 5. shop_orders
-- -------------------------------------------------------
create table shop_orders (
  id bigserial primary key,
  name text not null,
  phone text,
  email text,
  items jsonb not null, -- [{id, name, qty, size_or_flavor, unit_price}]
  total_amount numeric(10,2),
  payment_method varchar(20) default 'promptpay',
  slip_image text,
  slip_status varchar(30) default 'pending_review',
  slip_notes text,
  notes text,
  slip_uploaded_at timestamptz,
  slip_reviewed_at timestamptz,
  created_at timestamptz default now()
);

alter table shop_orders enable row level security;

create policy "Anyone can place shop order" on shop_orders
  for insert with check (true);

create policy "Staff can read shop orders" on shop_orders
  for select using (
    exists (select 1 from profiles where id = auth.uid())
  );

create policy "Staff can update shop orders" on shop_orders
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'staff'))
  );

create policy "Admin can delete shop orders" on shop_orders
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- -------------------------------------------------------
-- 6. cash_sales (POS layer)
-- -------------------------------------------------------
create table cash_sales (
  id bigserial primary key,
  sale_type varchar(50), -- 'membership' | 'shop' | 'event' | 'walkin'
  reference_id bigint, -- FK to member_registrations, shop_orders, or event_bookings
  amount numeric(10,2) not null,
  items jsonb, -- snapshot of what was sold
  processed_by uuid references profiles(id) not null,
  processed_at timestamptz default now(),
  drawer_opened boolean default false,
  receipt_printed boolean default false,
  notes text
);

alter table cash_sales enable row level security;

create policy "Staff can insert cash sales" on cash_sales
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'staff'))
  );

create policy "Staff can read cash sales" on cash_sales
  for select using (
    exists (select 1 from profiles where id = auth.uid())
  );

-- -------------------------------------------------------
-- 7. drawer_log (POS audit trail)
-- -------------------------------------------------------
create table drawer_log (
  id bigserial primary key,
  opened_by uuid references profiles(id) not null,
  opened_at timestamptz default now(),
  reason text, -- 'cash_sale' | 'manual_open' | 'no_sale'
  sale_id bigint references cash_sales(id),
  tablet_ip text
);

alter table drawer_log enable row level security;

create policy "Staff can insert drawer log" on drawer_log
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'staff'))
  );

create policy "Staff can read drawer log" on drawer_log
  for select using (
    exists (select 1 from profiles where id = auth.uid())
  );

-- -------------------------------------------------------
-- 8. settings
-- -------------------------------------------------------
create table settings (
  key varchar(100) primary key,
  value text,
  label text
);

alter table settings enable row level security;

create policy "Anyone can read settings" on settings
  for select using (true);

create policy "Admin can manage settings" on settings
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Seed base prices (THB)
insert into settings (key, value, label) values
  ('price_climb_unguided', '250', 'Unguided Climb (per session)'),
  ('price_session_group', '350', 'Group Session (per session)'),
  ('price_session_1to1', '600', '1-to-1 Session (per session)'),
  ('price_day_camp', '450', 'Day Camp (per session)'),
  ('price_combo_game_train', '400', 'Combo Game + Train (per session)'),
  ('price_all_day', '500', 'All Day (per session)'),
  ('price_monthly_2hr', '2500', 'Monthly 2hr Pass'),
  ('price_monthly_5hr', '5500', 'Monthly 5hr Pass'),
  ('price_sessions_4', '1200', '4-Session Card'),
  ('price_sessions_8', '2200', '8-Session Card'),
  ('price_sessions_16', '4000', '16-Session Card'),
  ('price_sessions_20', '4800', '20-Session Card'),
  ('price_day_camp_4', '1600', '4-Day Camp Card'),
  ('price_day_camp_8', '3000', '8-Day Camp Card'),
  ('price_day_camp_16', '5600', '16-Day Camp Card'),
  ('price_day_camp_20', '6800', '20-Day Camp Card'),
  ('price_sessions_1to1_4', '2200', '4x 1-to-1 Card'),
  ('price_sessions_1to1_8', '4200', '8x 1-to-1 Card'),
  ('price_sessions_1to1_16', '8000', '16x 1-to-1 Card'),
  ('price_sessions_1to1_20', '9600', '20x 1-to-1 Card'),
  ('price_all_day_4', '1800', '4x All Day Card'),
  ('price_all_day_8', '3400', '8x All Day Card'),
  ('price_all_day_16', '6400', '16x All Day Card'),
  ('price_all_day_20', '7800', '20x All Day Card'),
  ('price_combo_4', '1400', '4x Combo Card'),
  ('price_combo_8', '2600', '8x Combo Card'),
  ('price_combo_16', '4800', '16x Combo Card'),
  ('price_combo_20', '5800', '20x Combo Card'),
  ('birthday_rate_morning', '3000', 'Morning Rate/hr'),
  ('birthday_rate_afternoon', '5000', 'Afternoon Rate/hr'),
  ('birthday_rate_evening', '3000', 'Evening Rate/hr'),
  ('birthday_rate_weekend', '5000', 'Weekend Rate/hr'),
  ('birthday_extra_6_10', '500', 'Extra 6-10 kids'),
  ('birthday_extra_11_15', '1000', 'Extra 11-15 kids'),
  ('birthday_extra_16_20', '1500', 'Extra 16-20 kids');

-- -------------------------------------------------------
-- 9. work_instructions
-- -------------------------------------------------------
create table work_instructions (
  id bigserial primary key,
  topic_name varchar(150) not null,
  instructions text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table work_instructions enable row level security;

create policy "Staff can read work instructions" on work_instructions
  for select using (
    exists (select 1 from profiles where id = auth.uid())
  );

create policy "Admin can manage work instructions" on work_instructions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- -------------------------------------------------------
-- 10. Storage buckets (run separately in Supabase dashboard
--     or via CLI if MCP not available)
-- -------------------------------------------------------
-- insert into storage.buckets (id, name, public) values ('slips', 'slips', true);
-- insert into storage.buckets (id, name, public) values ('member-photos', 'member-photos', false);

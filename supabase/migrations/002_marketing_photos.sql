-- ============================================================
-- Migration 002: Marketing Photos + Photographer Upgrade
-- Run in Supabase SQL Editor
-- ============================================================

-- -------------------------------------------------------
-- 1. marketing_photos table
-- -------------------------------------------------------
create table marketing_photos (
  id bigserial primary key,
  file_path text not null,                          -- path in marketing-photos bucket
  caption text,
  member_id bigint references member_registrations(id) on delete set null,
  booking_id bigint references event_bookings(id) on delete set null,
  uploaded_by uuid references profiles(id) on delete set null,  -- staff who uploaded
  approved boolean not null default false,           -- staff approval gate
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  tags text[],                                       -- e.g. ['birthday','climbing','samui']
  created_at timestamptz default now()
);

alter table marketing_photos enable row level security;

-- Public can view approved photos only
create policy "Public can view approved photos" on marketing_photos
  for select using (approved = true);

-- Staff/admin can view all photos
create policy "Staff can view all photos" on marketing_photos
  for select using (
    exists (select 1 from profiles where id = auth.uid())
  );

-- Staff can insert photos
create policy "Staff can upload photos" on marketing_photos
  for insert with check (
    exists (select 1 from profiles where id = auth.uid())
  );

-- Admins can update (approve/reject/edit)
create policy "Admins can update photos" on marketing_photos
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','owner'))
  );

-- Admins can delete photos
create policy "Admins can delete photos" on marketing_photos
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','owner'))
  );

-- -------------------------------------------------------
-- 2. Add photographer upgrade columns to event_bookings
-- -------------------------------------------------------
alter table event_bookings
  add column if not exists photographer_requested boolean not null default false,
  add column if not exists photographer_fee integer not null default 0;
-- photographer_fee is in THB (e.g. 1500 for birthday, 2000 for day camp)

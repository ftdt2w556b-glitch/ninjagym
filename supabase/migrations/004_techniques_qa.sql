-- ============================================================
-- Migration 004: Techniques + Staff Q&A
-- Run in Supabase SQL Editor
-- ============================================================

-- -------------------------------------------------------
-- 1. Techniques (belt-level training guide)
-- -------------------------------------------------------
create table if not exists techniques (
  id bigserial primary key,
  belt_level int not null,        -- 1-5
  belt_color text not null,       -- yellow | orange | green | blue | red
  category text not null,         -- Stances | Rolls | Falls | Kicks | Strikes
  name text not null,
  slug text unique not null,
  instructions text default '',
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table techniques enable row level security;

create policy "Staff can read techniques" on techniques
  for select using (exists (select 1 from profiles where id = auth.uid()));

create policy "Admin can manage techniques" on techniques
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Seed Level 1 - Yellow Belt (Stances)
insert into techniques (belt_level, belt_color, category, name, slug, display_order) values
  (1,'yellow','Stances','Horse and Side Stance','horse-and-side-stance',1),
  (1,'yellow','Stances','Cat Stance','cat-stance',2),
  (1,'yellow','Stances','Defensive Stance','defensive-stance',3),
  (1,'yellow','Stances','Power Stance','power-stance',4),
  (1,'yellow','Stances','Fighting Stance','fighting-stance',5),
  (1,'yellow','Stances','Low Stance','low-stance',6),
  (1,'yellow','Stances','Bow and Open Stance','bow-and-open-stance',7),
  (1,'yellow','Stances','Blade Stance','blade-stance',8),
  (1,'yellow','Stances','Reactive Stance','reactive-stance',9),
  (1,'yellow','Stances','Combat Stance','combat-stance',10),
-- Level 2 - Orange Belt (Rolls)
  (2,'orange','Rolls','Forward Roll','forward-roll',1),
  (2,'orange','Rolls','Back Roll','back-roll',2),
  (2,'orange','Rolls','Side Roll','side-roll',3),
  (2,'orange','Rolls','Diving Roll','diving-roll',4),
  (2,'orange','Rolls','Dropping Rolls F-B-S','dropping-rolls-f-b-s',5),
  (2,'orange','Rolls','Roll with Object','roll-with-object',6),
  (2,'orange','Rolls','Superman Roll','superman-roll',7),
  (2,'orange','Rolls','Duck and Jump','duck-and-jump',8),
  (2,'orange','Rolls','Table Roll','table-roll',9),
  (2,'orange','Rolls','Flips','flips',10),
-- Level 3 - Green Belt (Falls)
  (3,'green','Falls','Flat Fall Forward','flat-fall-forward',1),
  (3,'green','Falls','Flat Fall Backward','flat-fall-backward',2),
  (3,'green','Falls','Side Fall','side-fall',3),
  (3,'green','Falls','Defensive Falls','defensive-falls',4),
  (3,'green','Falls','Fall with Objects','fall-with-objects',5),
  (3,'green','Falls','Stunt Falls','stunt-falls',6),
-- Level 4 - Blue Belt (Kicks)
  (4,'blue','Kicks','Front Kick','front-kick',1),
  (4,'blue','Kicks','Side Kick','side-kick',2),
  (4,'blue','Kicks','Roundhouse Kick','roundhouse-kick',3),
  (4,'blue','Kicks','Back Kick','back-kick',4),
  (4,'blue','Kicks','Spinning Kick','spinning-kick',5),
  (4,'blue','Kicks','Jump Kick','jump-kick',6),
  (4,'blue','Kicks','Axe Kick','axe-kick',7),
-- Level 5 - Red Belt (Strikes)
  (5,'red','Strikes','Straight Punch','straight-punch',1),
  (5,'red','Strikes','Palm Strike','palm-strike',2),
  (5,'red','Strikes','Hammer Fist','hammer-fist',3),
  (5,'red','Strikes','Elbow Strike','elbow-strike',4),
  (5,'red','Strikes','Knife Hand','knife-hand',5)
on conflict (slug) do nothing;

-- -------------------------------------------------------
-- 2. Staff Q&A
-- -------------------------------------------------------
create table if not exists staff_questions (
  id bigserial primary key,
  asked_by uuid references profiles(id),
  asker_name text not null,
  question text not null,
  answer text,
  answered_by uuid references profiles(id),
  answered_at timestamptz,
  created_at timestamptz default now()
);

alter table staff_questions enable row level security;

create policy "Staff can submit questions" on staff_questions
  for insert with check (exists (select 1 from profiles where id = auth.uid()));

create policy "Staff can read all questions" on staff_questions
  for select using (exists (select 1 from profiles where id = auth.uid()));

create policy "Admin can answer questions" on staff_questions
  for update using (exists (select 1 from profiles where id = auth.uid() and role in ('admin','owner')));

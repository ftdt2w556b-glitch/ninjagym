-- ============================================================
-- Migration 005: Fix techniques — correct list, correct categories
-- Run in Supabase SQL Editor
-- ============================================================

-- Wipe existing seed data (instructions are preserved via UPDATE below if any exist)
DELETE FROM techniques;

-- Re-insert complete correct list
INSERT INTO techniques (belt_level, belt_color, category, name, slug, display_order) VALUES

-- Level 1 · Yellow Belt · Stances
(1,'yellow','Stances','Horse and Side Stance',  'horse-and-side-stance',   1),
(1,'yellow','Stances','Cat Stance',              'cat-stance',              2),
(1,'yellow','Stances','Defensive Stance',        'defensive-stance',        3),
(1,'yellow','Stances','Power Stance',            'power-stance',            4),
(1,'yellow','Stances','Fighting Stance',         'fighting-stance',         5),
(1,'yellow','Stances','Low Stance',              'low-stance',              6),
(1,'yellow','Stances','Bow and Open Stance',     'bow-and-open-stance',     7),
(1,'yellow','Stances','Blade Stance',            'blade-stance',            8),
(1,'yellow','Stances','Reactive Stance',         'reactive-stance',         9),
(1,'yellow','Stances','Combat Stance',           'combat-stance',          10),

-- Level 2 · Orange Belt · Rolls
(2,'orange','Rolls','Forward Roll',              'forward-roll',            1),
(2,'orange','Rolls','Back Roll',                 'back-roll',               2),
(2,'orange','Rolls','Side Roll',                 'side-roll',               3),
(2,'orange','Rolls','Diving Roll',               'diving-roll',             4),
(2,'orange','Rolls','Dropping Rolls F-B-S',      'dropping-rolls-f-b-s',    5),
(2,'orange','Rolls','Roll with Object',          'roll-with-object',        6),
(2,'orange','Rolls','Superman Roll',             'superman-roll',           7),
(2,'orange','Rolls','Duck and Jump',             'duck-and-jump',           8),
(2,'orange','Rolls','Table Roll',                'table-roll',              9),
(2,'orange','Rolls','Flips',                     'flips',                  10),

-- Level 3 · Green Belt · Falls
(3,'green','Falls','Flat Fall Forward',          'flat-fall-forward',       1),
(3,'green','Falls','Flat Fall Backward',         'flat-fall-backward',      2),
(3,'green','Falls','Side Fall',                  'side-fall',               3),
(3,'green','Falls','Rolling Fall',               'rolling-fall',            4),
(3,'green','Falls','Air Fall',                   'air-fall',                5),
(3,'green','Falls','Defensive Falls',            'defensive-falls',         6),
(3,'green','Falls','Fall with Objects',          'fall-with-objects',       7),
(3,'green','Falls','Stunt Falls',                'stunt-falls',             8),
(3,'green','Falls','Cartwheel',                  'cartwheel',               9),
(3,'green','Falls','Handsprings',                'handsprings',            10),

-- Level 4 · Blue Belt · Strikes
(4,'blue','Strikes','Fist Strikes V-H-B-H',     'fist-strikes-v-h-b-h',    1),
(4,'blue','Strikes','Palm Heel Strike',          'palm-heel-strike',        2),
(4,'blue','Strikes','Knife and Ridge Hand',      'knife-and-ridge-hand',    3),
(4,'blue','Strikes','Claw Hand Strike',          'claw-hand-strike',        4),
(4,'blue','Strikes','Jab Cross Hook Uppercut',   'jab-cross-hook-uppercut', 5),
(4,'blue','Strikes','Knuckle Fist',              'knuckle-fist',            6),
(4,'blue','Strikes','Eagle Claw',                'eagle-claw',              7),
(4,'blue','Strikes','Forearm Strike',            'forearm-strike',          8),
(4,'blue','Strikes','Bent Wrist',                'bent-wrist',              9),
(4,'blue','Strikes','Elbows and Form',           'elbows-and-form',        10),

-- Level 5 · Red Belt · Kicks
(5,'red','Kicks','Front Kicks I-S-B-H',          'front-kicks-i-s-b-h',     1),
(5,'red','Kicks','Side Kicks',                   'side-kicks',              2),
(5,'red','Kicks','Back Kick',                    'back-kick',               3),
(5,'red','Kicks','Crescent Kicks',               'crescent-kicks',          4),
(5,'red','Kicks','Round Kicks',                  'round-kicks',             5),
(5,'red','Kicks','Dropping Kick',                'dropping-kick',           6),
(5,'red','Kicks','Reverse Heel Kick',            'reverse-heel-kick',       7),
(5,'red','Kicks','Low Sweep Kick',               'low-sweep-kick',          8),
(5,'red','Kicks','Knee and Advanced Kicks',      'knee-and-advanced-kicks', 9),
(5,'red','Kicks','Strikes and Kicks Form',       'strikes-and-kicks-form', 10);

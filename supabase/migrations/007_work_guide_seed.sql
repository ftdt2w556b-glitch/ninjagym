-- ============================================================
-- Migration 007: Work Guide — seed topics from dojo.ninjagym.com/work
-- Run in Supabase SQL Editor
-- Topic names from the old site; instructions to be filled via admin panel
-- ============================================================

-- Clear any existing empty placeholders first (keep any with real instructions)
DELETE FROM work_instructions WHERE instructions IS NULL OR instructions = '';

INSERT INTO work_instructions (topic_name, instructions) VALUES

-- ── Behind The Counter (BTC) — Daily Operations ──────────────
('BTC – Prepare Beverages',           NULL),
('BTC – Food Preparation',            NULL),
('BTC – Customer Interaction',        NULL),
('BTC – Marketing',                   NULL),
('BTC – Sales',                       NULL),
('BTC – Administrative Tasks',        NULL),
('BTC – Facility Maintenance',        NULL),
('BTC – Staff Coordination',          NULL),
('BTC – Inventory Management',        NULL),
('BTC – Customer Feedback',           NULL),
('BTC – Event Coordination',          NULL),
('BTC – Emergency Procedures',        NULL),
('BTC – Conflict Resolution',         NULL),
('BTC – Scheduling',                  NULL),
('BTC – Minimum Training Requirements', NULL),
('BTC – Tools And Equipment',         NULL),

-- ── Running a Class — Coaches Guide ─────────────────────────
('Class – Be Professional (TIC TOC)',       NULL),
('Class – Class Order',                     NULL),
('Class – Starting Class: MBS Position',    NULL),
('Class – Mental Focus Of The Week',        NULL),
('Class – Message Of The Week',             NULL),
('Class – Warm Up',                         NULL),
('Class – Light Stretch (Head to Toe)',     NULL),
('Class – Dynamic Stretching',             NULL),
('Class – Class Structure',                NULL),
('Class – During Class',                   NULL),
('Class – Rolls And Falls',                NULL),
('Class – Finishing Class (BLAST)',        NULL),
('Class – Ending Class Review',            NULL);

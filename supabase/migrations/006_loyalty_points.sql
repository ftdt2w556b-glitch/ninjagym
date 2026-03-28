-- ============================================================
-- Migration 006: Loyalty Points System
-- Run in Supabase SQL Editor
-- ============================================================

-- Add loyalty_points to member profiles (tracked on member_registrations)
ALTER TABLE member_registrations
  ADD COLUMN IF NOT EXISTS loyalty_points_awarded INT DEFAULT 0;

-- Loyalty transaction log — one row per earn event
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL,                        -- match by email (works for non-registered users too)
  profile_id    UUID REFERENCES profiles(id) ON DELETE SET NULL, -- null until email is matched to account
  source_type   TEXT NOT NULL CHECK (source_type IN ('shop_order','registration','birthday','daycamp','manual')),
  source_id     BIGINT,                               -- FK to the originating record
  points        INT NOT NULL DEFAULT 0,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by email
CREATE INDEX IF NOT EXISTS idx_loyalty_email ON loyalty_transactions(email);
CREATE INDEX IF NOT EXISTS idx_loyalty_profile ON loyalty_transactions(profile_id);

-- Loyalty summary view — total points per email
CREATE OR REPLACE VIEW loyalty_summary AS
SELECT
  email,
  profile_id,
  SUM(points)  AS total_points,
  COUNT(*)     AS total_transactions,
  MAX(created_at) AS last_activity
FROM loyalty_transactions
GROUP BY email, profile_id;

-- ============================================================
-- Points earning rules (applied in application code):
--   shop_order      : 1 point per 100 THB spent (min 1)
--   registration    : 1 point per 100 THB paid
--   birthday        : 1 point per 100 THB + 10 bonus points
--   daycamp         : 1 point per 100 THB + 5 bonus points
--   manual          : admin-granted points
--
-- Tier thresholds (for future rewards UI):
--   0–49   : Rookie Ninja     (no badge)
--   50–149 : Yellow Belt      (5% shop discount)
--   150–299: Orange Belt      (10% shop discount)
--   300–499: Green Belt       (15% shop discount + priority booking)
--   500–999: Blue Belt        (20% shop discount + free shake & bake)
--   1000+  : Red Belt Legend  (25% discount + VIP perks)
-- ============================================================

-- RLS
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Admin/owner can read all
CREATE POLICY "admin_read_loyalty" ON loyalty_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','owner')
    )
  );

-- Admin can insert (awarded on approval)
CREATE POLICY "admin_insert_loyalty" ON loyalty_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin','owner')
    )
  );

-- Users can view their own transactions (matched by profile)
CREATE POLICY "user_read_own_loyalty" ON loyalty_transactions
  FOR SELECT USING (profile_id = auth.uid());

-- Allow service role full access (for server-side award logic)
CREATE POLICY "service_role_loyalty" ON loyalty_transactions
  USING (true)
  WITH CHECK (true);

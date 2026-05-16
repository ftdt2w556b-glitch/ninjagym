-- =============================================================================
-- 015_staff_pin_dashboard.sql
-- Per-staff PIN now also step-up authenticates dashboard sessions.
--
-- profiles.pin already exists (bcrypt). This migration adds the two new
-- supporting tables the dashboard gate needs:
--
-- (a) staff_pin_attempts — per-user rate limiter so a leaked login can't
--     brute-force the 4-digit PIN. 5 wrong / 10 min → 30 min lockout.
-- (b) staff_actions      — audit log. Every write that goes through the
--     dashboard PIN gate stamps a row here, so we can show who approved /
--     rejected / edited / deleted each booking.
--
-- RLS: service-role only on both tables, dashboard reads via createAdminClient.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.staff_pin_attempts (
  user_id      UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  fails        INT          NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_pin_attempts_locked
  ON public.staff_pin_attempts (locked_until)
  WHERE locked_until IS NOT NULL;

ALTER TABLE public.staff_pin_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.staff_pin_attempts;
CREATE POLICY "service_role_full_access"
  ON public.staff_pin_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


CREATE TABLE IF NOT EXISTS public.staff_actions (
  id            BIGSERIAL    PRIMARY KEY,
  user_id       UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type   TEXT         NOT NULL,
  target_table  TEXT,
  target_id     TEXT,
  ip            TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_actions_target
  ON public.staff_actions (target_table, target_id);

CREATE INDEX IF NOT EXISTS idx_staff_actions_user_time
  ON public.staff_actions (user_id, created_at DESC);

ALTER TABLE public.staff_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.staff_actions;
CREATE POLICY "service_role_full_access"
  ON public.staff_actions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

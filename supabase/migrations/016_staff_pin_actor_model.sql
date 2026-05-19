-- =============================================================================
-- 016_staff_pin_actor_model.sql
-- Correct the staff PIN audit model: attribution comes from the PIN typed
-- per action, not from the shared NinjaGym login session.
--
-- (a) Replace staff_pin_attempts (user_id PK) with an IP-keyed table since
--     every PIN attempt at the centre originates from the same shared login.
-- (b) Extend staff_actions with actor_kind / actor_id / actor_name resolved
--     from the PIN. Keep user_id as a secondary "session user" reference so
--     admin/owner self-approvals (Rick on his phone) still record properly.
-- =============================================================================

-- (a) Replace the old user-keyed attempts table with an IP-keyed one.
DROP TABLE IF EXISTS public.staff_pin_attempts;

CREATE TABLE public.staff_pin_attempts (
  ip           TEXT         PRIMARY KEY,
  fails        INT          NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_pin_attempts_locked
  ON public.staff_pin_attempts (locked_until)
  WHERE locked_until IS NOT NULL;

ALTER TABLE public.staff_pin_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access"
  ON public.staff_pin_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- (b) Extend staff_actions: actor_* identifies the person resolved from the
--     PIN. actor_kind is 'pos_staff' or 'profile' to disambiguate the FK.
ALTER TABLE public.staff_actions
  ADD COLUMN IF NOT EXISTS actor_kind TEXT,
  ADD COLUMN IF NOT EXISTS actor_id   TEXT,
  ADD COLUMN IF NOT EXISTS actor_name TEXT;

CREATE INDEX IF NOT EXISTS idx_staff_actions_actor
  ON public.staff_actions (actor_kind, actor_id);

COMMENT ON COLUMN public.staff_actions.user_id    IS 'Supabase session user (the shared NinjaGym login on centre devices, or a real admin on their phone). Audit forensics, not display.';
COMMENT ON COLUMN public.staff_actions.actor_kind IS 'pos_staff or profile, which table actor_id refers to. Resolved from the PIN typed at action time.';
COMMENT ON COLUMN public.staff_actions.actor_name IS 'Display name shown beside the row in the admin UI (Approved by ...).';

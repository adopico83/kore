-- Ejecutar en Supabase SQL Editor (orden: Limpieza → Sueño → Colegio)
-- Kore: dominios estructurados

-- ═══════════════════════════════════════
-- BLOQUE 1 — LIMPIEZA
-- ═══════════════════════════════════════

ALTER TABLE cleaning_tasks
  ADD COLUMN IF NOT EXISTS last_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_due_at date;

CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_family_next_due
  ON cleaning_tasks (family_id, next_due_at);

-- Migración: derivar next_due_at desde created_at + frequency
UPDATE cleaning_tasks
SET next_due_at = CASE
  WHEN lower(coalesce(frequency, 'semanal')) IN ('diaria', 'daily') THEN
    (coalesce(created_at, now())::date + INTERVAL '1 day')::date
  WHEN lower(coalesce(frequency, 'semanal')) IN ('mensual', 'monthly') THEN
    (coalesce(created_at, now())::date + INTERVAL '30 days')::date
  ELSE
    (coalesce(created_at, now())::date + INTERVAL '7 days')::date
END
WHERE next_due_at IS NULL;

-- Tareas recurrentes: completed deja de ser el criterio de pendiente
UPDATE cleaning_tasks SET completed = false WHERE completed IS TRUE;

-- ═══════════════════════════════════════
-- BLOQUE 2 — SUEÑO (sleep_sessions)
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS sleep_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sleep_start timestamptz NOT NULL,
  sleep_end timestamptz NOT NULL,
  wake_count integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sleep_sessions_family_start
  ON sleep_sessions (family_id, sleep_start DESC);

CREATE INDEX IF NOT EXISTS idx_sleep_sessions_profile
  ON sleep_sessions (profile_id);

ALTER TABLE sleep_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sleep_sessions_family_access ON sleep_sessions;
CREATE POLICY sleep_sessions_family_access ON sleep_sessions
  FOR ALL
  USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  );

-- ═══════════════════════════════════════
-- BLOQUE 3 — COLEGIO + sync Agenda
-- ═══════════════════════════════════════

ALTER TABLE school_events
  ADD COLUMN IF NOT EXISTS calendar_event_id uuid
  REFERENCES calendar_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_school_events_family_date
  ON school_events (family_id, date);

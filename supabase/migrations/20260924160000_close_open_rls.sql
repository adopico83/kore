-- Cierra policies RLS abiertas y revoca el rol anon.
-- Idempotente. No aplica storage (bucket corcho-fotos) ni cambia el cron de push:
-- /api/push sigue con CRON_SECRET y el service role, que ignora RLS.
-- El alta de familia y dominios sigue en servidor con createAdminClient().

BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.family_id
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.get_my_family_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_family_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_family_id() TO authenticated;

-- Policies con USING/WITH CHECK (true), más los nombres abiertos conocidos.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    IF btrim(coalesce(pol.qual, '')) IN ('true', '(true)')
       OR btrim(coalesce(pol.with_check, '')) IN ('true', '(true)')
       OR pol.policyname ILIKE '%allow_all%'
       OR pol.policyname IN (
         'allow_insert_domains_on_register',
         'kore_notifications_authenticated',
         'family_isolation'
       )
    THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON %I.%I',
        pol.policyname,
        pol.schemaname,
        pol.tablename
      );
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS allow_all ON public.agent_memory;
DROP POLICY IF EXISTS allow_all ON public.calendar_events;
DROP POLICY IF EXISTS allow_all ON public.cleaning_tasks;
DROP POLICY IF EXISTS allow_all ON public.conversations;
DROP POLICY IF EXISTS allow_all ON public.daily_metrics;
DROP POLICY IF EXISTS allow_all ON public.domain_history;
DROP POLICY IF EXISTS allow_all ON public.domains;
DROP POLICY IF EXISTS allow_insert_domains_on_register ON public.domains;
DROP POLICY IF EXISTS allow_all ON public.events_log;
DROP POLICY IF EXISTS allow_all ON public.expenses;
DROP POLICY IF EXISTS allow_all ON public.health_records;
DROP POLICY IF EXISTS allow_all ON public.kore_notes;
DROP POLICY IF EXISTS family_isolation ON public.kore_notes;
DROP POLICY IF EXISTS allow_all ON public.leisure_activities;
DROP POLICY IF EXISTS allow_all ON public.menu_items;
DROP POLICY IF EXISTS allow_all ON public.messages;
DROP POLICY IF EXISTS allow_all ON public.profiles;
DROP POLICY IF EXISTS allow_all ON public.school_events;
DROP POLICY IF EXISTS allow_all ON public.school_materials;
DROP POLICY IF EXISTS allow_all ON public.shopping_items;
DROP POLICY IF EXISTS allow_all ON public.sleep_logs;
DROP POLICY IF EXISTS allow_all ON public.sleep_sessions;
DROP POLICY IF EXISTS sleep_sessions_family_access ON public.sleep_sessions;
DROP POLICY IF EXISTS allow_all ON public.families;
DROP POLICY IF EXISTS allow_all ON public.agent_messages;
DROP POLICY IF EXISTS allow_all ON public.push_subscriptions;
DROP POLICY IF EXISTS allow_all ON public.kore_notifications;
DROP POLICY IF EXISTS kore_notifications_authenticated ON public.kore_notifications;

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kore_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kore_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leisure_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_sessions ENABLE ROW LEVEL SECURITY;

-- profiles: get_my_family_id es SECURITY DEFINER y no reentra en esta policy.
DROP POLICY IF EXISTS profiles_select_family ON public.profiles;
CREATE POLICY profiles_select_family ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR family_id = (SELECT public.get_my_family_id())
  );

DROP POLICY IF EXISTS profiles_update_family ON public.profiles;
CREATE POLICY profiles_update_family ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR family_id = (SELECT public.get_my_family_id())
  )
  WITH CHECK (
    family_id = (SELECT public.get_my_family_id())
  );

DROP POLICY IF EXISTS families_select_own ON public.families;
CREATE POLICY families_select_own ON public.families
  FOR SELECT TO authenticated
  USING (id = (SELECT public.get_my_family_id()));

DROP POLICY IF EXISTS events_log_select_family ON public.events_log;
CREATE POLICY events_log_select_family ON public.events_log
  FOR SELECT TO authenticated
  USING (family_id = (SELECT public.get_my_family_id()));

DROP POLICY IF EXISTS events_log_insert_own ON public.events_log;
CREATE POLICY events_log_insert_own ON public.events_log
  FOR INSERT TO authenticated
  WITH CHECK (
    family_id = (SELECT public.get_my_family_id())
    AND user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS events_log_delete_own ON public.events_log;
CREATE POLICY events_log_delete_own ON public.events_log
  FOR DELETE TO authenticated
  USING (
    family_id = (SELECT public.get_my_family_id())
    AND user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS push_subscriptions_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (
    family_id = (SELECT public.get_my_family_id())
    AND profile_id = (SELECT auth.uid())
  )
  WITH CHECK (
    family_id = (SELECT public.get_my_family_id())
    AND profile_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS agent_messages_own ON public.agent_messages;
CREATE POLICY agent_messages_own ON public.agent_messages
  FOR ALL TO authenticated
  USING (
    family_id = (SELECT public.get_my_family_id())
    AND user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    family_id = (SELECT public.get_my_family_id())
    AND user_id = (SELECT auth.uid())
  );

DO $$
DECLARE
  t text;
  family_tables text[] := ARRAY[
    'agent_memory',
    'calendar_events',
    'cleaning_tasks',
    'conversations',
    'daily_metrics',
    'domain_history',
    'domains',
    'expenses',
    'health_records',
    'kore_notes',
    'leisure_activities',
    'menu_items',
    'messages',
    'school_events',
    'school_materials',
    'shopping_items',
    'sleep_logs',
    'sleep_sessions'
  ];
  policy_name text;
BEGIN
  FOREACH t IN ARRAY family_tables LOOP
    policy_name := t || '_family';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (family_id = (SELECT public.get_my_family_id())) WITH CHECK (family_id = (SELECT public.get_my_family_id()))',
      policy_name,
      t
    );
  END LOOP;
END $$;

-- kore_notifications no tiene family_id. Sin policy: solo service role (notify / cron).
REVOKE ALL ON TABLE public.kore_notifications FROM anon;
REVOKE ALL ON TABLE public.kore_notifications FROM PUBLIC;
REVOKE ALL ON TABLE public.kore_notifications FROM authenticated;

DO $$
DECLARE
  t text;
  locked text[] := ARRAY[
    'agent_memory',
    'agent_messages',
    'calendar_events',
    'cleaning_tasks',
    'conversations',
    'daily_metrics',
    'domain_history',
    'domains',
    'events_log',
    'expenses',
    'families',
    'health_records',
    'kore_notes',
    'leisure_activities',
    'menu_items',
    'messages',
    'profiles',
    'push_subscriptions',
    'school_events',
    'school_materials',
    'shopping_items',
    'sleep_logs',
    'sleep_sessions'
  ];
BEGIN
  FOREACH t IN ARRAY locked LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', t);
  END LOOP;
END $$;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.families TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.events_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_messages TO authenticated;

DO $$
DECLARE
  t text;
  family_tables text[] := ARRAY[
    'agent_memory',
    'calendar_events',
    'cleaning_tasks',
    'conversations',
    'daily_metrics',
    'domain_history',
    'domains',
    'expenses',
    'health_records',
    'kore_notes',
    'leisure_activities',
    'menu_items',
    'messages',
    'school_events',
    'school_materials',
    'shopping_items',
    'sleep_logs',
    'sleep_sessions'
  ];
BEGIN
  FOREACH t IN ARRAY family_tables LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
      t
    );
  END LOOP;
END $$;

-- Fotos del Corcho: si existe la tabla, ciérrala por familia. El bucket no se toca.
DO $$
BEGIN
  IF to_regclass('public.kore_note_images') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.kore_note_images ENABLE ROW LEVEL SECURITY';
  EXECUTE 'REVOKE ALL ON TABLE public.kore_note_images FROM anon';
  EXECUTE 'REVOKE ALL ON TABLE public.kore_note_images FROM PUBLIC';

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kore_note_images'
      AND column_name = 'family_id'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS kore_note_images_family ON public.kore_note_images';
    EXECUTE $policy$
      CREATE POLICY kore_note_images_family ON public.kore_note_images
      FOR ALL TO authenticated
      USING (family_id = (SELECT public.get_my_family_id()))
      WITH CHECK (family_id = (SELECT public.get_my_family_id()))
    $policy$;
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kore_note_images TO authenticated';
  END IF;
END $$;

COMMIT;

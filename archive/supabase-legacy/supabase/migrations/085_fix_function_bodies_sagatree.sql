-- Fix: 079 renamed sagadrive_* helpers and dropped characters.sagadrive_profile,
-- but left ~28 function bodies calling the old names (e.g. ensure_native_starter_project
-- -> seed_dornhain_starter_characters: "column c.sagadrive_profile does not exist").
-- Rewrite every remaining public function body: sagadrive -> sagatree. Idempotent
-- (no-op once no body mentions sagadrive). CREATE OR REPLACE keeps owner and grants.

DO $$
DECLARE
  r RECORD;
  new_def TEXT;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND pg_get_functiondef(p.oid) ~* 'sagadrive'
    ORDER BY p.oid
  LOOP
    new_def := regexp_replace(
      regexp_replace(pg_get_functiondef(r.oid), 'sagadrive', 'sagatree', 'g'),
      'SagaDrive', 'SagaTree', 'g'
    );
    EXECUTE new_def;
  END LOOP;
END;
$$;

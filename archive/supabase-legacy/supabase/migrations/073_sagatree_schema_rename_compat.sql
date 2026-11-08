-- #sagatree-schema-infra-rename — Canonical SagaTree schema identifiers with
-- non-breaking SagaDrive compatibility aliases for one transition window.
-- Does NOT rewrite historical migrations 001–072.

-- ---------------------------------------------------------------------------
-- 1) Profile column: add sagatree_profile, backfill, bidirectional sync
-- ---------------------------------------------------------------------------
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS sagatree_profile JSONB;

UPDATE public.characters
SET sagatree_profile = sagadrive_profile
WHERE sagatree_profile IS NULL
  AND sagadrive_profile IS NOT NULL;

COMMENT ON COLUMN public.characters.sagatree_profile IS
  'SagaTree Core character profile (canonical). sagadrive_profile is a sync alias during rename transition.';

CREATE OR REPLACE FUNCTION public.sagatree_sync_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.sagatree_profile IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.sagatree_profile IS DISTINCT FROM OLD.sagatree_profile)
  THEN
    NEW.sagadrive_profile := NEW.sagatree_profile;
  ELSIF NEW.sagadrive_profile IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.sagadrive_profile IS DISTINCT FROM OLD.sagadrive_profile)
  THEN
    NEW.sagatree_profile := NEW.sagadrive_profile;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sagatree_sync_profile_columns ON public.characters;
CREATE TRIGGER trg_sagatree_sync_profile_columns
  BEFORE INSERT OR UPDATE OF sagatree_profile, sagadrive_profile
  ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.sagatree_sync_profile_columns();

GRANT SELECT, INSERT, UPDATE, REFERENCES (sagatree_profile) ON TABLE public.characters TO authenticated;
GRANT SELECT, INSERT, UPDATE, REFERENCES (sagatree_profile) ON TABLE public.characters TO anon;

-- ---------------------------------------------------------------------------
-- 2) Ruleset key: allow sagatree-core + legacy sagadrive-core; migrate rows
-- ---------------------------------------------------------------------------
ALTER TABLE public.characters DROP CONSTRAINT IF EXISTS characters_ruleset_key_check;
ALTER TABLE public.characters
  ADD CONSTRAINT characters_ruleset_key_check
  CHECK (ruleset_key = ANY (ARRAY['sagatree-core'::text, 'sagadrive-core'::text, 'dnd-5.5e'::text]));

UPDATE public.characters
SET ruleset_key = 'sagatree-core'
WHERE ruleset_key = 'sagadrive-core';

ALTER TABLE public.character_presets DROP CONSTRAINT IF EXISTS character_presets_ruleset_key_check;
ALTER TABLE public.character_presets
  ADD CONSTRAINT character_presets_ruleset_key_check
  CHECK (ruleset_key = ANY (ARRAY['sagatree-core'::text, 'sagadrive-core'::text, 'dnd-5.5e'::text]));

UPDATE public.character_presets
SET ruleset_key = 'sagatree-core'
WHERE ruleset_key = 'sagadrive-core';

ALTER TABLE public.characters ALTER COLUMN ruleset_key SET DEFAULT 'sagatree-core';
ALTER TABLE public.character_presets ALTER COLUMN ruleset_key SET DEFAULT 'sagatree-core';

-- ---------------------------------------------------------------------------
-- 3) Sheet-complete guard: accept either ruleset key / either profile column
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_character_sheet_status_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ruleset TEXT := COALESCE(NEW.ruleset_key, 'sagatree-core');
  v_profile JSONB := COALESCE(NEW.sagatree_profile, NEW.sagadrive_profile);
BEGIN
  IF NEW.sheet_status IS DISTINCT FROM 'complete' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.sheet_status, 'incomplete') = 'complete'
  THEN
    RETURN NEW;
  END IF;

  IF NEW.name IS NULL OR length(btrim(NEW.name)) < 1
     OR NEW.class IS NULL OR length(btrim(NEW.class)) < 1
     OR NEW.race IS NULL OR length(btrim(NEW.race)) < 1
     OR NEW.level IS NULL OR NEW.level < 1 OR NEW.level > 20
  THEN
    RAISE EXCEPTION 'Unvollständiger Charakter kann nicht als complete markiert werden'
      USING ERRCODE = '22023';
  END IF;

  IF v_ruleset IN ('sagatree-core', 'sagadrive-core')
     AND (
       v_profile IS NULL
       OR NEW.attributes IS NULL
       OR NEW.skills IS NULL
     )
  THEN
    RAISE EXCEPTION 'SagaTree-Bögen brauchen Profil, Attribute und Skills für complete'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_character_sheet_status_complete ON public.characters;
CREATE TRIGGER trg_enforce_character_sheet_status_complete
  BEFORE INSERT OR UPDATE OF sheet_status, name, class, race, level, ruleset_key,
    sagatree_profile, sagadrive_profile, attributes, skills
  ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_character_sheet_status_complete();

-- ---------------------------------------------------------------------------
-- 4) Rename sagadrive_* helpers → sagatree_*; recreate sagadrive_* wrappers
--    (trigger functions are renamed only — triggers store OID / are re-bound)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  new_name TEXT;
  arg_list TEXT;
  new_exists BOOLEAN;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.proname LIKE 'sagadrive_%'
        OR p.proname = 'generate_sagadrive_public_id'
      )
    ORDER BY p.proname
  LOOP
    IF r.proname = 'generate_sagadrive_public_id' THEN
      new_name := 'generate_sagatree_public_id';
    ELSE
      new_name := 'sagatree_' || substr(r.proname, length('sagadrive_') + 1);
    END IF;

    arg_list := pg_get_function_identity_arguments(r.oid);
    SELECT EXISTS (
      SELECT 1
      FROM pg_proc p2
      JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
      WHERE n2.nspname = 'public'
        AND p2.proname = new_name
        AND pg_get_function_identity_arguments(p2.oid) = arg_list
    ) INTO new_exists;
    IF new_exists THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) RENAME TO %I',
      r.proname,
      arg_list,
      new_name
    );
  END LOOP;
END;
$$;

-- Legacy-name wrappers (non-trigger) so SQL still calling sagadrive_* keeps working.
CREATE OR REPLACE FUNCTION public.generate_sagadrive_public_id(p_prefix TEXT)
RETURNS TEXT
LANGUAGE sql
SET search_path = public, pg_temp
AS $$ SELECT public.generate_sagatree_public_id(p_prefix); $$;

CREATE OR REPLACE FUNCTION public.sagadrive_empty_adventure_runtime()
RETURNS JSONB
LANGUAGE sql
SET search_path = public, pg_temp
AS $$ SELECT public.sagatree_empty_adventure_runtime(); $$;

CREATE OR REPLACE FUNCTION public.sagadrive_ensure_adventure_v2(p_adv JSONB)
RETURNS JSONB
LANGUAGE sql
SET search_path = public, pg_temp
AS $$ SELECT public.sagatree_ensure_adventure_v2(p_adv); $$;

CREATE OR REPLACE FUNCTION public.sagadrive_ensure_saga_draft(p_saga_id UUID)
RETURNS public.saga_definition_versions
LANGUAGE sql
SET search_path = public, pg_temp
AS $$ SELECT public.sagatree_ensure_saga_draft(p_saga_id); $$;

CREATE OR REPLACE FUNCTION public.sagadrive_find_session_consequence(p_session_id UUID, p_consequence_id TEXT)
RETURNS JSONB
LANGUAGE sql
SET search_path = public, pg_temp
AS $$ SELECT public.sagatree_find_session_consequence(p_session_id, p_consequence_id); $$;

CREATE OR REPLACE FUNCTION public.sagadrive_project_saga_definition_payload(p_payload JSONB, p_is_gm BOOLEAN)
RETURNS JSONB
LANGUAGE sql
SET search_path = public, pg_temp
AS $$ SELECT public.sagatree_project_saga_definition_payload(p_payload, p_is_gm); $$;

CREATE OR REPLACE FUNCTION public.sagadrive_project_shared_adventure(p_shared JSONB, p_is_gm BOOLEAN)
RETURNS JSONB
LANGUAGE sql
SET search_path = public, pg_temp
AS $$ SELECT public.sagatree_project_shared_adventure(p_shared, p_is_gm); $$;

CREATE OR REPLACE FUNCTION public.sagadrive_resolve_adventure_command(
  p_session_id UUID, p_payload JSONB, p_is_gm BOOLEAN, p_world JSONB
)
RETURNS JSONB
LANGUAGE sql
SET search_path = public, pg_temp
AS $$ SELECT public.sagatree_resolve_adventure_command(p_session_id, p_payload, p_is_gm, p_world); $$;

-- Re-bind forbid trigger to canonical name (rename already moved OID; make name explicit).
DROP TRIGGER IF EXISTS trg_forbid_native_saga_insert ON public.saga_definitions;
CREATE TRIGGER trg_forbid_native_saga_insert
  BEFORE INSERT ON public.saga_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.sagatree_forbid_native_saga_insert();

REVOKE ALL ON FUNCTION public.generate_sagatree_public_id(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_sagatree_public_id(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.generate_sagadrive_public_id(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_sagadrive_public_id(TEXT) TO authenticated;

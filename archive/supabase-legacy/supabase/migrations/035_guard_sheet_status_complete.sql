-- 035: Block trivial sheet_status elevation to complete via direct PostgREST UPDATE/INSERT.
-- Full SagaDrive build asserts stay in the app; DB requires identity + sagadrive payload presence.

CREATE OR REPLACE FUNCTION public.enforce_character_sheet_status_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.sheet_status IS DISTINCT FROM 'complete' THEN
    RETURN NEW;
  END IF;

  -- Elevating to complete (or inserting as complete) needs minimum identity + build payloads.
  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.sheet_status, 'incomplete') = 'complete'
  THEN
    -- Already complete: allow other field updates without re-gate.
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

  IF COALESCE(NEW.ruleset_key, 'sagadrive-core') = 'sagadrive-core'
     AND (
       NEW.sagadrive_profile IS NULL
       OR NEW.attributes IS NULL
       OR NEW.skills IS NULL
     )
  THEN
    RAISE EXCEPTION 'SagaDrive-Bögen brauchen Profil, Attribute und Skills für complete'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_character_sheet_status_complete ON public.characters;

CREATE TRIGGER trg_enforce_character_sheet_status_complete
  BEFORE INSERT OR UPDATE OF sheet_status, name, class, race, level, ruleset_key,
    sagadrive_profile, attributes, skills
  ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_character_sheet_status_complete();

COMMENT ON FUNCTION public.enforce_character_sheet_status_complete() IS
  'DB gate: sheet_status=complete requires identity fields + SagaDrive payloads; app still runs full asserts.';

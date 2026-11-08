-- Session Look override (#349).
-- Extends public.sessions; LookProfile ids are TEXT (046_look_profiles).
-- NULL = inherit saga default (then system default via Look resolution).

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS look_profile_id TEXT
    REFERENCES public.look_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sessions.look_profile_id IS
  'Optional session LookProfile override. NULL → inherit saga default_look_profile_id (then system default).';

CREATE INDEX IF NOT EXISTS idx_sessions_look_profile
  ON public.sessions(look_profile_id)
  WHERE look_profile_id IS NOT NULL;

-- GM (project owner) may only bind an active LookProfile they own.
CREATE OR REPLACE FUNCTION public.enforce_session_look_profile_binding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  look_owner UUID;
  look_status TEXT;
  project_gm UUID;
BEGIN
  IF NEW.look_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.look_profile_id IS NOT DISTINCT FROM OLD.look_profile_id THEN
    RETURN NEW;
  END IF;

  SELECT gm_user_id INTO project_gm
  FROM public.projects
  WHERE id = NEW.project_id;

  IF project_gm IS NULL THEN
    RAISE EXCEPTION 'session look_profile_id requires a valid project';
  END IF;

  IF project_gm IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'session look_profile_id may only be set by the saga GM';
  END IF;

  SELECT owner_user_id, status
    INTO look_owner, look_status
  FROM public.look_profiles
  WHERE id = NEW.look_profile_id;

  IF look_owner IS NULL THEN
    RAISE EXCEPTION 'look_profile_id must reference an existing LookProfile';
  END IF;

  IF look_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'look_profile_id may only reference a LookProfile you own';
  END IF;

  IF look_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'look_profile_id must reference an active LookProfile';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sessions_look_binding ON public.sessions;
CREATE TRIGGER trg_sessions_look_binding
  BEFORE INSERT OR UPDATE OF look_profile_id ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_session_look_profile_binding();

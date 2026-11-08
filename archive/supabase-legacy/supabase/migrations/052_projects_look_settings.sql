-- Saga default Look + player override permission (#348).
-- Extends public.projects; LookProfile ids are TEXT (046_look_profiles).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS default_look_profile_id TEXT
    REFERENCES public.look_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS allow_player_character_look_override BOOLEAN
    NOT NULL DEFAULT true;

COMMENT ON COLUMN public.projects.default_look_profile_id IS
  'Optional saga default LookProfile. NULL → resolution falls back to system default.';

COMMENT ON COLUMN public.projects.allow_player_character_look_override IS
  'When true, player-character personal Look overrides may apply in resolution.';

CREATE INDEX IF NOT EXISTS idx_projects_default_look_profile
  ON public.projects(default_look_profile_id)
  WHERE default_look_profile_id IS NOT NULL;

-- GM may only bind an active LookProfile they own (visible under look_profiles RLS).
CREATE OR REPLACE FUNCTION public.enforce_default_look_profile_binding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  look_owner UUID;
  look_status TEXT;
BEGIN
  IF NEW.default_look_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.default_look_profile_id IS NOT DISTINCT FROM OLD.default_look_profile_id THEN
    RETURN NEW;
  END IF;

  SELECT owner_user_id, status
    INTO look_owner, look_status
  FROM public.look_profiles
  WHERE id = NEW.default_look_profile_id;

  IF look_owner IS NULL THEN
    RAISE EXCEPTION 'default_look_profile_id must reference an existing LookProfile';
  END IF;

  IF look_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'default_look_profile_id may only reference a LookProfile you own';
  END IF;

  IF look_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'default_look_profile_id must reference an active LookProfile';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_default_look_binding ON public.projects;
CREATE TRIGGER trg_projects_default_look_binding
  BEFORE INSERT OR UPDATE OF default_look_profile_id ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_default_look_profile_binding();

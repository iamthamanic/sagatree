-- Personal player-character Look override write gate (#351).
-- appearance.personal_look_profile_id may only be set by the character owner when
-- every *active* saga arc for that character allows player overrides, and the Look
-- is active + owned by the writer. Clearing to null is always allowed for the owner.

CREATE OR REPLACE FUNCTION public.enforce_personal_look_profile_binding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_personal TEXT;
  old_personal TEXT;
  look_owner UUID;
  look_status TEXT;
  blocked_project UUID;
BEGIN
  new_personal := NULLIF(trim(BOTH FROM COALESCE(NEW.appearance->>'personal_look_profile_id', '')), '');
  old_personal := NULLIF(trim(BOTH FROM COALESCE(OLD.appearance->>'personal_look_profile_id', '')), '');

  -- No change to personal look field → skip.
  IF new_personal IS NOT DISTINCT FROM old_personal THEN
    RETURN NEW;
  END IF;

  -- Owner-only (RLS also gates, but fail closed here).
  IF NEW.owner_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'personal_look_profile_id may only be changed by the character owner';
  END IF;

  -- Clearing override is always allowed for the owner.
  IF new_personal IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look must exist, be active, and owned by the writer.
  SELECT owner_user_id, status
    INTO look_owner, look_status
  FROM public.look_profiles
  WHERE id = new_personal;

  IF look_owner IS NULL THEN
    RAISE EXCEPTION 'personal_look_profile_id must reference an existing LookProfile';
  END IF;

  IF look_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'personal_look_profile_id may only reference a LookProfile you own';
  END IF;

  IF look_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'personal_look_profile_id must reference an active LookProfile';
  END IF;

  -- If any active adventure arc's project disallows player overrides, reject.
  SELECT caa.project_id
    INTO blocked_project
  FROM public.character_adventure_arcs caa
  JOIN public.projects p ON p.id = caa.project_id
  WHERE caa.character_id = NEW.id
    AND caa.status = 'active'
    AND p.allow_player_character_look_override IS FALSE
  LIMIT 1;

  IF blocked_project IS NOT NULL THEN
    RAISE EXCEPTION 'personal Look override is not allowed for this character''s active saga';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_characters_personal_look_binding ON public.characters;
CREATE TRIGGER trg_characters_personal_look_binding
  BEFORE UPDATE OF appearance ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_personal_look_profile_binding();

COMMENT ON FUNCTION public.enforce_personal_look_profile_binding() IS
  'Gate appearance.personal_look_profile_id writes: owner + active owned Look + saga allow flag (#351).';

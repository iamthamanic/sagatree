-- 032: Incomplete character drafts cannot enter adventures/sessions.
-- join_project_by_code + set_my_project_character require owned PC + sheet_status = 'complete'
-- when a character_id is supplied (NULL still allowed = join without character).

CREATE OR REPLACE FUNCTION public.join_project_by_code(
  p_code TEXT,
  p_character_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_project_id UUID;
  v_existing_status TEXT;
  v_sheet_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(BTRIM(p_code), '') IS NULL THEN
    RAISE EXCEPTION 'Project code is required' USING ERRCODE = '22023';
  END IF;

  SELECT id
  INTO v_project_id
  FROM public.projects
  WHERE UPPER(BTRIM(code)) = UPPER(BTRIM(p_code))
    AND status = 'active';

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT status
  INTO v_existing_status
  FROM public.project_members
  WHERE project_id = v_project_id
    AND user_id = v_user_id;

  IF FOUND THEN
    RAISE EXCEPTION 'Project membership already exists with status %', v_existing_status
      USING ERRCODE = 'P0001';
  END IF;

  IF p_character_id IS NOT NULL THEN
    SELECT sheet_status
    INTO v_sheet_status
    FROM public.characters
    WHERE id = p_character_id
      AND owner_user_id = v_user_id
      AND character_type = 'pc';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Character is not owned by the current user' USING ERRCODE = '42501';
    END IF;

    IF COALESCE(v_sheet_status, 'complete') <> 'complete' THEN
      RAISE EXCEPTION 'Unvollständige Charakterbögen können keinem Abenteuer beitreten'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.project_members (
    project_id,
    user_id,
    character_id,
    role,
    status
  ) VALUES (
    v_project_id,
    v_user_id,
    p_character_id,
    'player',
    'active'
  );

  RETURN v_project_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_my_project_character(
  p_project_id UUID,
  p_character_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_member_id UUID;
  v_sheet_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_character_id IS NOT NULL THEN
    SELECT sheet_status
    INTO v_sheet_status
    FROM public.characters
    WHERE id = p_character_id
      AND owner_user_id = v_user_id
      AND character_type = 'pc';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Character is not owned by the current user' USING ERRCODE = '42501';
    END IF;

    IF COALESCE(v_sheet_status, 'complete') <> 'complete' THEN
      RAISE EXCEPTION 'Unvollständige Charakterbögen können keinem Abenteuer zugewiesen werden'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.project_members
  SET character_id = p_character_id
  WHERE project_id = p_project_id
    AND user_id = v_user_id
    AND status = 'active'
  RETURNING id INTO v_member_id;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Active project membership not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_member_id;
END;
$$;

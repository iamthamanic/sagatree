-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.join_project_by_code(p_code text, p_character_id uuid = NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
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

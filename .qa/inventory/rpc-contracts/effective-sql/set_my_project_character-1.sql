-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.set_my_project_character(p_project_id uuid, p_character_id uuid = NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
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

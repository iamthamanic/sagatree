-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.assign_npc_creature_controller(p_project_id uuid, p_definition_id text, p_controller_user_id uuid = NULL) RETURNS public.npc_creature_controller_assignments LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_definition_id TEXT := btrim(COALESCE(p_definition_id, ''));
  v_row public.npc_creature_controller_assignments;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'missing project';
  END IF;

  IF char_length(v_definition_id) < 10 OR char_length(v_definition_id) > 160 THEN
    RAISE EXCEPTION 'invalid definition id';
  END IF;

  -- Actor must be the project GM and an active member.
  IF NOT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND p.gm_user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'only gm may assign controller';
  END IF;

  IF NOT public.current_user_is_active_project_member(p_project_id) THEN
    RAISE EXCEPTION 'actor is not an active project member';
  END IF;

  -- Controller must be null (unassigned / GM) or an active member.
  IF p_controller_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = p_project_id
        AND pm.user_id = p_controller_user_id
        AND pm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'controller is not an active project member';
    END IF;
  END IF;

  -- Prefer Full sheet when a persisted definition exists; fail closed if present but not full.
  IF EXISTS (
    SELECT 1
    FROM public.npc_creature_definitions d
    WHERE d.id = v_definition_id
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.npc_creature_definitions d
    WHERE d.id = v_definition_id
      AND d.status = 'active'
      AND COALESCE(d.payload->>'sheetMode', '') = 'full'
  ) THEN
    RAISE EXCEPTION 'definition is not a full character sheet';
  END IF;

  INSERT INTO public.npc_creature_controller_assignments (
    project_id,
    definition_id,
    controller_user_id,
    assigned_by,
    updated_at
  )
  VALUES (
    p_project_id,
    v_definition_id,
    p_controller_user_id,
    v_actor,
    NOW()
  )
  ON CONFLICT (project_id, definition_id) DO UPDATE
  SET
    controller_user_id = EXCLUDED.controller_user_id,
    assigned_by = EXCLUDED.assigned_by,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

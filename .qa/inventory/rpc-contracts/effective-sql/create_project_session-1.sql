-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.create_project_session(p_project_id uuid, p_name text = NULL, p_notes text = NULL) RETURNS public.sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  created public.sessions;
  actor UUID := auth.uid();
  is_member BOOLEAN := false;
  v_adv JSONB := '{}'::jsonb;
  v_knowledge JSONB := NULL;
  v_world JSONB;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
     WHERE pm.project_id = p_project_id AND pm.user_id = actor AND pm.status = 'active' AND pm.role IN ('gm', 'player')
  ) OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = p_project_id AND p.gm_user_id = actor)
  INTO is_member;
  IF NOT is_member THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT COALESCE(adventure_runtime, '{}'::jsonb) INTO v_adv
  FROM public.projects WHERE id = p_project_id;
  IF jsonb_typeof(v_adv) IS DISTINCT FROM 'object' THEN
    v_adv := '{}'::jsonb;
  END IF;

  -- Carry knowledge from most recent completed session world_state when present.
  SELECT s.world_state->'shared'->'knowledge' INTO v_knowledge
  FROM public.sessions s
  WHERE s.project_id = p_project_id
    AND s.status = 'completed'
    AND s.world_state ? 'shared'
    AND (s.world_state->'shared') ? 'knowledge'
  ORDER BY s.session_number DESC
  LIMIT 1;

  v_world := jsonb_build_object(
    'shared',
    CASE
      WHEN v_knowledge IS NOT NULL AND jsonb_typeof(v_knowledge) = 'object' THEN
        jsonb_build_object('adventure', v_adv, 'knowledge', v_knowledge)
      ELSE
        jsonb_build_object('adventure', v_adv)
    END
  );

  INSERT INTO public.sessions (project_id, session_number, name, notes, status, code, world_state)
  VALUES (
    p_project_id,
    public.allocate_next_session_number(p_project_id),
    NULLIF(btrim(p_name), ''),
    NULLIF(btrim(p_notes), ''),
    'scheduled',
    public.generate_unique_session_code(),
    v_world
  )
  RETURNING * INTO created;
  RETURN created;
END;
$$;

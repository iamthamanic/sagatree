-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.clear_npc_creature_instance_temp_controllers_for_session(p_session_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_project_id UUID;
  v_count INTEGER := 0;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'missing session';
  END IF;

  SELECT s.project_id INTO v_project_id
  FROM public.sessions s
  WHERE s.id = p_session_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'session not found';
  END IF;

  PERFORM public.assert_npc_creature_instance_gm(v_project_id);

  UPDATE public.npc_creature_instances
  SET runtime = jsonb_set(
        COALESCE(runtime, '{}'::jsonb),
        '{temporaryControllerUserId}',
        'null'::jsonb,
        true
      ),
      updated_at = NOW()
  WHERE session_id = p_session_id
    AND runtime ? 'temporaryControllerUserId'
    AND runtime->>'temporaryControllerUserId' IS NOT NULL
    AND btrim(COALESCE(runtime->>'temporaryControllerUserId', '')) <> '';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

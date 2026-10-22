-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.spawn_npc_creature_instance(p_project_id uuid, p_definition_id text, p_instance_kind text, p_snapshot jsonb, p_runtime jsonb, p_display_name text, p_sequence_number integer, p_session_id uuid = NULL) RETURNS public.npc_creature_instances LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_actor UUID;
  v_definition_id TEXT := btrim(COALESCE(p_definition_id, ''));
  v_display_name TEXT := btrim(COALESCE(p_display_name, ''));
  v_kind TEXT := btrim(COALESCE(p_instance_kind, ''));
  v_row public.npc_creature_instances;
  v_session_project UUID;
BEGIN
  v_actor := public.assert_npc_creature_instance_gm(p_project_id);

  IF char_length(v_definition_id) < 10 OR char_length(v_definition_id) > 160 THEN
    RAISE EXCEPTION 'invalid definition id';
  END IF;

  IF v_kind NOT IN ('generic', 'persistent') THEN
    RAISE EXCEPTION 'invalid instance kind';
  END IF;

  IF char_length(v_display_name) < 1 OR char_length(v_display_name) > 120 THEN
    RAISE EXCEPTION 'invalid display name';
  END IF;

  IF p_sequence_number IS NULL OR p_sequence_number < 1 THEN
    RAISE EXCEPTION 'invalid sequence number';
  END IF;

  IF jsonb_typeof(p_snapshot) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid snapshot';
  END IF;

  IF jsonb_typeof(p_runtime) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid runtime';
  END IF;

  -- Persistent uniques are campaign-scoped (no session).
  IF v_kind = 'persistent' AND p_session_id IS NOT NULL THEN
    RAISE EXCEPTION 'persistent instances must not bind a session';
  END IF;

  IF p_session_id IS NOT NULL THEN
    SELECT s.project_id INTO v_session_project
    FROM public.sessions s
    WHERE s.id = p_session_id;
    IF v_session_project IS NULL OR v_session_project IS DISTINCT FROM p_project_id THEN
      RAISE EXCEPTION 'session does not belong to project';
    END IF;
  END IF;

  -- Definition reference validation:
  -- - core:/builtin: ids are snapshot-only (no DB row required)
  -- - personal:/world: must exist and be readable by actor (or archived but still present)
  IF v_definition_id LIKE 'personal:%' OR v_definition_id LIKE 'world:%' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.npc_creature_definitions d
      WHERE d.id = v_definition_id
        AND (
          (d.scope = 'personal' AND d.owner_user_id = v_actor)
          OR (d.scope = 'world' AND public.current_user_can_read_world_profile(d.world_profile_id))
        )
    ) THEN
      RAISE EXCEPTION 'definition not readable';
    END IF;
  END IF;

  -- Temp controller inside runtime must be null or active member.
  IF p_runtime ? 'temporaryControllerUserId'
     AND jsonb_typeof(p_runtime->'temporaryControllerUserId') = 'string'
     AND btrim(p_runtime->>'temporaryControllerUserId') <> '' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = p_project_id
        AND pm.user_id = (p_runtime->>'temporaryControllerUserId')::uuid
        AND pm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'temporary controller is not an active project member';
    END IF;
  END IF;

  INSERT INTO public.npc_creature_instances (
    project_id,
    session_id,
    definition_id,
    display_name,
    instance_kind,
    sequence_number,
    snapshot,
    runtime,
    created_by,
    created_at,
    updated_at
  )
  VALUES (
    p_project_id,
    CASE WHEN v_kind = 'persistent' THEN NULL ELSE p_session_id END,
    v_definition_id,
    v_display_name,
    v_kind,
    p_sequence_number,
    p_snapshot,
    p_runtime,
    v_actor,
    NOW(),
    NOW()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.get_session_runtime_snapshot(p_session_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  actor UUID := auth.uid();
  v_session public.sessions;
  v_roster JSONB;
  v_shared JSONB;
  v_is_gm BOOLEAN;
  v_character_id UUID;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id required' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_session_participant(p_session_id, actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;

  v_is_gm := public.is_project_gm(v_session.project_id, actor);
  SELECT sp.character_id INTO v_character_id
  FROM public.session_players sp
  WHERE sp.session_id = p_session_id AND sp.user_id = actor
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'userId', sp.user_id,
      'characterId', sp.character_id,
      'isOnline', sp.is_online,
      'joinedAt', sp.joined_at
    )
    ORDER BY sp.joined_at
  ), '[]'::jsonb)
  INTO v_roster
  FROM public.session_players sp
  WHERE sp.session_id = p_session_id;

  v_shared := public.sagatree_project_shared_knowledge(
    COALESCE(v_session.world_state->'shared', '{}'::jsonb),
    v_is_gm,
    v_character_id
  );
  v_shared := public.sagatree_project_shared_adventure(v_shared, v_is_gm);

  RETURN jsonb_build_object(
    'sessionId', v_session.id,
    'revision', v_session.runtime_revision,
    'status', CASE WHEN v_session.status = 'scheduled' THEN 'waiting' ELSE v_session.status END,
    'roster', v_roster,
    'gameplay', jsonb_build_object(
      'sceneId', COALESCE(v_session.world_state->>'sceneId', v_session.world_state->>'scene_id'),
      'combatActive', COALESCE(
        (v_session.world_state->>'combatActive')::boolean,
        (v_session.world_state->>'combat_active')::boolean,
        false
      ),
      'shared', v_shared
    ),
    'updatedAt', v_session.updated_at
  );
END;
$$;

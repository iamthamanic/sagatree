-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.apply_session_runtime_command(p_session_id uuid, p_expected_revision bigint, p_kind text, p_payload jsonb = CAST('{}' AS jsonb), p_idempotency_key text = NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  actor UUID := auth.uid();
  v_session public.sessions;
  v_new_revision BIGINT;
  v_world JSONB;
  v_existing public.session_events;
  v_key TEXT := NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '');
  v_is_gm BOOLEAN;
  v_is_director BOOLEAN;
  v_roll JSONB;
  v_combat JSONB;
  v_presentation JSONB;
  v_program JSONB;
  v_knowledge JSONB;
  v_life JSONB;
  v_adventure JSONB;
  v_cue JSONB;
  v_scene_id TEXT;
  v_event_payload JSONB := COALESCE(p_payload, '{}'::jsonb);
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id required' USING ERRCODE = '22023';
  END IF;
  IF p_kind NOT IN (
    'join', 'leave', 'presence', 'status', 'roll', 'damage',
    'condition', 'scene', 'combat', 'gameplay', 'program', 'reveal',
    'life', 'adventure', 'cue'
  ) THEN
    RAISE EXCEPTION 'Invalid event kind' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_session_participant(p_session_id, actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.session_events
    WHERE session_id = p_session_id AND idempotency_key = v_key
    LIMIT 1;
    IF FOUND THEN
      RETURN public.get_session_runtime_snapshot(p_session_id)
        || jsonb_build_object('idempotentReplay', true, 'eventId', v_existing.id);
    END IF;
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_session.status = 'completed' AND p_kind NOT IN ('leave', 'presence') THEN
    RAISE EXCEPTION 'Completed sessions cannot accept gameplay commands' USING ERRCODE = '22023';
  END IF;
  IF v_session.runtime_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'stale revision: expected %, actual %',
      p_expected_revision, v_session.runtime_revision
      USING ERRCODE = '40001';
  END IF;

  v_new_revision := v_session.runtime_revision + 1;
  v_world := COALESCE(v_session.world_state, '{}'::jsonb);
  v_is_gm := public.is_project_gm(v_session.project_id, actor);
  v_is_director := public.sagatree_session_has_director(p_session_id, actor);

  IF p_kind = 'roll' THEN
    v_roll := public.sagatree_resolve_session_check(p_session_id, actor, p_payload, v_is_gm);
    v_event_payload := v_roll->'eventPayload';
    v_world := v_roll->'worldState';
  ELSIF p_kind = 'combat' THEN
    v_combat := public.sagatree_resolve_combat_command(
      p_session_id, actor, p_payload, v_is_gm, v_world
    );
    v_event_payload := v_combat->'eventPayload';
    v_world := v_combat->'worldState';
  ELSIF p_kind = 'damage' THEN
    v_combat := public.sagatree_resolve_damage_command(p_payload, v_is_gm, v_world);
    v_event_payload := v_combat->'eventPayload';
    v_world := v_combat->'worldState';
  ELSIF p_kind = 'condition' THEN
    v_combat := public.sagatree_resolve_condition_command(p_payload, v_is_gm, v_world);
    v_event_payload := v_combat->'eventPayload';
    v_world := v_combat->'worldState';
  ELSIF p_kind = 'life' THEN
    v_life := public.sagatree_resolve_life_command(p_payload, v_is_gm, v_world);
    v_event_payload := v_life->'eventPayload';
    v_world := v_life->'worldState';
  ELSIF p_kind = 'adventure' THEN
    v_adventure := public.sagatree_resolve_adventure_command(
      p_session_id, p_payload, v_is_gm, v_world
    );
    v_event_payload := v_adventure->'eventPayload';
    v_world := v_adventure->'worldState';
  ELSIF p_kind = 'cue' THEN
    v_cue := public.sagatree_resolve_cue_command(p_payload, v_is_gm, v_is_director, v_world);
    v_event_payload := v_cue->'eventPayload';
    v_world := v_cue->'worldState';
  ELSIF p_kind = 'scene' THEN
    IF NOT v_is_gm THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF p_payload ? 'title' OR p_payload ? 'visibleActors' OR p_payload ? 'backdropUrl'
       OR p_payload ? 'description' OR p_payload ? 'locationLabel' OR p_payload ? 'sceneRef' THEN
      v_presentation := public.sagatree_build_scene_presentation(p_payload);
      v_scene_id := NULLIF(v_presentation->>'_sceneId', '');
      v_presentation := v_presentation - '_sceneId';
      v_world := jsonb_set(v_world, '{shared}', COALESCE(v_world->'shared', '{}'::jsonb), true);
      v_world := jsonb_set(v_world, '{shared,scenePresentation}', v_presentation, true);
      IF v_scene_id IS NOT NULL THEN
        v_world := jsonb_set(v_world, '{sceneId}', to_jsonb(v_scene_id), true);
      END IF;
      v_event_payload := v_presentation;
    ELSE
      IF p_payload ? 'sceneId' THEN
        v_world := jsonb_set(v_world, '{sceneId}', to_jsonb(p_payload->>'sceneId'), true);
      END IF;
    END IF;
  ELSIF p_kind = 'program' THEN
    IF NOT v_is_gm AND NOT v_is_director THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    v_program := public.sagatree_build_program_presentation(
      p_payload,
      COALESCE(v_world->'shared'->'programPresentation', NULL)
    );
    v_world := jsonb_set(v_world, '{shared}', COALESCE(v_world->'shared', '{}'::jsonb), true);
    v_world := jsonb_set(v_world, '{shared,programPresentation}', v_program, true);
    v_event_payload := v_program;
  ELSIF p_kind = 'reveal' THEN
    IF NOT v_is_gm THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    v_knowledge := public.sagatree_apply_knowledge_reveal(v_world, p_payload, actor);
    v_world := v_knowledge->'worldState';
    v_event_payload := v_knowledge->'eventPayload';
  ELSIF p_kind = 'gameplay' THEN
    IF NOT v_is_gm THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF p_payload ? 'sceneId' THEN
      v_world := jsonb_set(v_world, '{sceneId}', to_jsonb(p_payload->>'sceneId'), true);
    END IF;
    IF p_payload ? 'checkTarget' AND (p_payload->>'checkTarget') ~ '^-?[0-9]+$' THEN
      v_world := jsonb_set(v_world, '{shared}', COALESCE(v_world->'shared', '{}'::jsonb), true);
      v_world := jsonb_set(
        v_world,
        '{shared,checkTarget}',
        to_jsonb((p_payload->>'checkTarget')::int),
        true
      );
    END IF;
  END IF;

  IF p_kind = 'presence' THEN
    UPDATE public.session_players
       SET is_online = COALESCE((p_payload->>'isOnline')::boolean, true)
     WHERE session_id = p_session_id AND user_id = actor;
  END IF;

  IF p_kind = 'status' THEN
    IF NOT v_is_gm THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.sessions
     SET runtime_revision = v_new_revision,
         world_state = v_world,
         updated_at = NOW()
   WHERE id = p_session_id;

  PERFORM public.append_session_event(
    p_session_id, p_kind, actor, COALESCE(v_event_payload, '{}'::jsonb), v_new_revision, v_key
  );

  RETURN public.get_session_runtime_snapshot(p_session_id)
    || jsonb_build_object('idempotentReplay', false);
END;
$$;

-- 043_session_shared_scene_presentation.sql
-- Shared scene presentation V1 (#301): GM-authored visual context under
-- world_state.shared.scenePresentation. Merges without wiping lastRoll (#299).

CREATE OR REPLACE FUNCTION public.sagadrive_is_http_url(p_url TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_url IS NULL OR BTRIM(p_url) = '' THEN
    RETURN TRUE;
  END IF;
  IF char_length(p_url) > 2048 THEN
    RETURN FALSE;
  END IF;
  RETURN lower(p_url) ~ '^https?://';
END;
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_build_scene_presentation(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_title TEXT;
  v_location TEXT;
  v_description TEXT;
  v_backdrop TEXT;
  v_scene_id TEXT;
  v_ref JSONB;
  v_ref_kind TEXT;
  v_ref_id TEXT;
  v_actors JSONB := '[]'::jsonb;
  v_actor JSONB;
  v_actor_out JSONB;
  v_name TEXT;
  v_kind TEXT;
  v_role TEXT;
  v_portrait TEXT;
  v_i INT;
BEGIN
  -- Strip forged server-owned keys
  p_payload := p_payload - 'authoritative' - 'updatedAt' - 'updated_at' - 'revision' - 'schemaVersion';

  v_title := NULLIF(BTRIM(COALESCE(p_payload->>'title', '')), '');
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Szenen-Titel ist erforderlich' USING ERRCODE = '22023';
  END IF;
  v_title := left(v_title, 120);

  v_location := NULLIF(BTRIM(COALESCE(p_payload->>'locationLabel', '')), '');
  IF v_location IS NOT NULL THEN
    v_location := left(v_location, 120);
  END IF;

  v_description := NULLIF(BTRIM(COALESCE(p_payload->>'description', '')), '');
  IF v_description IS NOT NULL THEN
    v_description := left(v_description, 500);
  END IF;

  v_backdrop := NULLIF(BTRIM(COALESCE(p_payload->>'backdropUrl', '')), '');
  IF v_backdrop IS NOT NULL THEN
    v_backdrop := left(v_backdrop, 2048);
    IF NOT public.sagadrive_is_http_url(v_backdrop) THEN
      RAISE EXCEPTION 'Backdrop-URL muss http(s) sein oder leer' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_scene_id := NULLIF(BTRIM(COALESCE(p_payload->>'sceneId', '')), '');
  IF v_scene_id IS NOT NULL THEN
    v_scene_id := left(v_scene_id, 128);
  END IF;

  v_ref := NULL;
  IF p_payload ? 'sceneRef' AND jsonb_typeof(p_payload->'sceneRef') = 'object' THEN
    v_ref_kind := NULLIF(BTRIM(COALESCE(p_payload->'sceneRef'->>'kind', '')), '');
    IF v_ref_kind IN ('session-local', 'adventure-scene', 'world-location') THEN
      v_ref_id := NULLIF(BTRIM(COALESCE(p_payload->'sceneRef'->>'id', '')), '');
      IF v_ref_id IS NOT NULL THEN
        v_ref_id := left(v_ref_id, 128);
      END IF;
      v_ref := jsonb_build_object('kind', v_ref_kind, 'id', to_jsonb(v_ref_id));
    END IF;
  END IF;

  IF v_ref IS NULL AND v_scene_id IS NOT NULL THEN
    v_ref := jsonb_build_object('kind', 'session-local', 'id', to_jsonb(v_scene_id));
  END IF;

  IF p_payload ? 'visibleActors' AND jsonb_typeof(p_payload->'visibleActors') = 'array' THEN
    FOR v_i IN 0 .. LEAST(jsonb_array_length(p_payload->'visibleActors') - 1, 23) LOOP
      v_actor := p_payload->'visibleActors'->v_i;
      IF jsonb_typeof(v_actor) <> 'object' THEN
        CONTINUE;
      END IF;
      v_name := NULLIF(BTRIM(COALESCE(v_actor->>'displayName', '')), '');
      IF v_name IS NULL THEN
        CONTINUE;
      END IF;
      v_name := left(v_name, 80);
      v_kind := COALESCE(NULLIF(BTRIM(v_actor->>'kind'), ''), 'other');
      IF v_kind NOT IN ('character', 'npc', 'creature', 'other') THEN
        v_kind := 'other';
      END IF;
      v_role := COALESCE(NULLIF(BTRIM(v_actor->>'role'), ''), CASE WHEN v_kind = 'character' THEN 'pc' ELSE 'other' END);
      IF v_role NOT IN ('pc', 'npc', 'creature', 'other') THEN
        v_role := 'other';
      END IF;
      v_portrait := NULLIF(BTRIM(COALESCE(v_actor->>'portraitUrl', '')), '');
      IF v_portrait IS NOT NULL THEN
        v_portrait := left(v_portrait, 2048);
        IF NOT public.sagadrive_is_http_url(v_portrait) THEN
          v_portrait := NULL;
        END IF;
      END IF;
      v_actor_out := jsonb_build_object(
        'kind', v_kind,
        'id', to_jsonb(NULLIF(left(BTRIM(COALESCE(v_actor->>'id', '')), 128), '')),
        'publicId', to_jsonb(NULLIF(left(BTRIM(COALESCE(v_actor->>'publicId', '')), 64), '')),
        'displayName', v_name,
        'portraitUrl', to_jsonb(v_portrait),
        'role', v_role
      );
      v_actors := v_actors || jsonb_build_array(v_actor_out);
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'schemaVersion', 1,
    'title', v_title,
    'locationLabel', to_jsonb(v_location),
    'description', to_jsonb(v_description),
    'backdropUrl', to_jsonb(v_backdrop),
    'sceneRef', COALESCE(v_ref, 'null'::jsonb),
    'visibleActors', v_actors,
    'updatedAt', to_jsonb(NOW() AT TIME ZONE 'utc'),
    'authoritative', true,
    '_sceneId', to_jsonb(
      COALESCE(
        v_scene_id,
        NULLIF(BTRIM(COALESCE(v_ref->>'id', '')), '')
      )
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_session_runtime_command(
  p_session_id UUID,
  p_expected_revision BIGINT,
  p_kind TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  v_session public.sessions;
  v_new_revision BIGINT;
  v_world JSONB;
  v_existing public.session_events;
  v_key TEXT := NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '');
  v_is_gm BOOLEAN;
  v_roll JSONB;
  v_event_payload JSONB := COALESCE(p_payload, '{}'::jsonb);
  v_presentation JSONB;
  v_scene_id TEXT;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id required' USING ERRCODE = '22023';
  END IF;
  IF p_kind NOT IN (
    'join', 'leave', 'presence', 'status', 'roll', 'damage',
    'condition', 'scene', 'combat', 'gameplay'
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

  IF p_kind = 'roll' THEN
    v_roll := public.sagadrive_resolve_session_check(p_session_id, actor, p_payload, v_is_gm);
    v_event_payload := v_roll->'eventPayload';
    v_world := v_roll->'worldState';
  ELSIF p_kind = 'scene' THEN
    IF NOT v_is_gm THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    -- Full presentation payload (title required) OR legacy sceneId-only switch
    IF p_payload ? 'title' OR p_payload ? 'visibleActors' OR p_payload ? 'backdropUrl'
       OR p_payload ? 'description' OR p_payload ? 'locationLabel' OR p_payload ? 'sceneRef' THEN
      v_presentation := public.sagadrive_build_scene_presentation(p_payload);
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
      IF p_payload ? 'combatActive' THEN
        v_world := jsonb_set(v_world, '{combatActive}', to_jsonb((p_payload->>'combatActive')::boolean), true);
      END IF;
      -- Never replace entire shared blob from client on scene commands
    END IF;
  ELSIF p_kind IN ('combat', 'gameplay', 'condition', 'damage') THEN
    IF NOT v_is_gm AND p_kind IN ('combat', 'gameplay') THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF p_payload ? 'sceneId' THEN
      v_world := jsonb_set(v_world, '{sceneId}', to_jsonb(p_payload->>'sceneId'), true);
    END IF;
    IF p_payload ? 'combatActive' THEN
      v_world := jsonb_set(v_world, '{combatActive}', to_jsonb((p_payload->>'combatActive')::boolean), true);
    END IF;
    IF p_payload ? 'shared' AND jsonb_typeof(p_payload->'shared') = 'object' THEN
      v_world := jsonb_set(v_world, '{shared}', p_payload->'shared', true);
    END IF;
    IF p_kind = 'gameplay' AND v_is_gm AND p_payload ? 'checkTarget'
       AND (p_payload->>'checkTarget') ~ '^-?[0-9]+$' THEN
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

REVOKE ALL ON FUNCTION public.apply_session_runtime_command(UUID, BIGINT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_session_runtime_command(UUID, BIGINT, TEXT, JSONB, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.sagadrive_build_scene_presentation(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sagadrive_build_scene_presentation(JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.sagadrive_is_http_url(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sagadrive_is_http_url(TEXT) TO authenticated;

COMMENT ON FUNCTION public.sagadrive_build_scene_presentation IS
  'Builds authoritative shared.scenePresentation (#301); strips forged metadata; http(s) backdrop only.';

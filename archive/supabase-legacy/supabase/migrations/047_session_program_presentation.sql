-- 047_session_program_presentation.sql
-- Program Output presentation state (#365): world_state.shared.programPresentation
-- Event kind `program`. SharedScenePresentation remains a source input (#301).

ALTER TABLE public.session_events DROP CONSTRAINT IF EXISTS session_events_kind_check;
ALTER TABLE public.session_events
  ADD CONSTRAINT session_events_kind_check CHECK (kind IN (
    'join', 'leave', 'presence', 'status', 'roll', 'damage',
    'condition', 'scene', 'combat', 'gameplay', 'program'
  ));

CREATE OR REPLACE FUNCTION public.sagadrive_build_program_presentation(
  p_payload JSONB,
  p_previous JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_source JSONB;
  v_source_kind TEXT;
  v_look_id TEXT;
  v_layout JSONB;
  v_layout_kind TEXT;
  v_overlay JSONB;
  v_overlay_text TEXT;
  v_prev_rev BIGINT := 0;
BEGIN
  p_payload := COALESCE(p_payload, '{}'::jsonb)
    - 'authoritative' - 'updatedAt' - 'updated_at'
    - 'revision' - 'schemaVersion' - 'programRevision'
    - 'gm_only' - 'character_specific';

  IF p_payload ? 'gm_only' OR p_payload ? 'character_specific' THEN
    RAISE EXCEPTION 'Program payload darf keine Secrets enthalten' USING ERRCODE = '22023';
  END IF;

  IF p_previous IS NOT NULL AND jsonb_typeof(p_previous) = 'object' THEN
    v_prev_rev := COALESCE((p_previous->>'programRevision')::bigint, 0);
  END IF;

  v_source_kind := NULLIF(BTRIM(COALESCE(p_payload->'source'->>'kind', '')), '');
  IF v_source_kind IS NULL OR v_source_kind NOT IN ('neutral', 'shared-scene', 'look') THEN
    v_source_kind := 'shared-scene';
  END IF;

  IF v_source_kind = 'look' THEN
    v_look_id := NULLIF(BTRIM(COALESCE(p_payload->'source'->>'lookId', '')), '');
    IF v_look_id IS NOT NULL THEN
      v_look_id := left(v_look_id, 128);
    END IF;
    v_source := jsonb_build_object('kind', 'look', 'lookId', to_jsonb(v_look_id));
  ELSIF v_source_kind = 'neutral' THEN
    v_source := jsonb_build_object('kind', 'neutral');
  ELSE
    v_source := jsonb_build_object('kind', 'shared-scene');
  END IF;

  v_layout_kind := NULLIF(BTRIM(COALESCE(p_payload->'layout'->>'kind', '')), '');
  IF v_layout_kind IS NULL OR v_layout_kind NOT IN ('fullscreen-16x9', 'letterbox') THEN
    v_layout_kind := 'fullscreen-16x9';
  END IF;
  v_layout := jsonb_build_object('kind', v_layout_kind);

  v_overlay := NULL;
  IF p_payload ? 'overlay' AND jsonb_typeof(p_payload->'overlay') = 'object' THEN
    IF COALESCE(p_payload->'overlay'->>'kind', '') = 'title' THEN
      v_overlay_text := NULLIF(BTRIM(COALESCE(p_payload->'overlay'->>'text', '')), '');
      IF v_overlay_text IS NOT NULL THEN
        v_overlay := jsonb_build_object(
          'kind', 'title',
          'text', left(v_overlay_text, 120)
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'schemaVersion', 1,
    'programRevision', v_prev_rev + 1,
    'source', v_source,
    'layout', v_layout,
    'overlay', COALESCE(v_overlay, 'null'::jsonb),
    'updatedAt', to_jsonb(NOW() AT TIME ZONE 'utc'),
    'authoritative', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_session_runtime_command(
  p_session_id UUID,
  p_expected_revision BIGINT,
  p_kind TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  v_combat JSONB;
  v_presentation JSONB;
  v_program JSONB;
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
    'condition', 'scene', 'combat', 'gameplay', 'program'
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
  ELSIF p_kind = 'combat' THEN
    v_combat := public.sagadrive_resolve_combat_command(
      p_session_id, actor, p_payload, v_is_gm, v_world
    );
    v_event_payload := v_combat->'eventPayload';
    v_world := v_combat->'worldState';
  ELSIF p_kind = 'damage' THEN
    v_combat := public.sagadrive_resolve_damage_command(p_payload, v_is_gm, v_world);
    v_event_payload := v_combat->'eventPayload';
    v_world := v_combat->'worldState';
  ELSIF p_kind = 'condition' THEN
    v_combat := public.sagadrive_resolve_condition_command(p_payload, v_is_gm, v_world);
    v_event_payload := v_combat->'eventPayload';
    v_world := v_combat->'worldState';
  ELSIF p_kind = 'scene' THEN
    IF NOT v_is_gm THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
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
    END IF;
  ELSIF p_kind = 'program' THEN
    -- GM-only until director membership is persisted server-side (#375/#376).
    IF NOT v_is_gm THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    v_program := public.sagadrive_build_program_presentation(
      p_payload,
      COALESCE(v_world->'shared'->'programPresentation', NULL)
    );
    v_world := jsonb_set(v_world, '{shared}', COALESCE(v_world->'shared', '{}'::jsonb), true);
    v_world := jsonb_set(v_world, '{shared,programPresentation}', v_program, true);
    v_event_payload := v_program;
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

REVOKE ALL ON FUNCTION public.apply_session_runtime_command(UUID, BIGINT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_session_runtime_command(UUID, BIGINT, TEXT, JSONB, TEXT) TO authenticated;

COMMENT ON FUNCTION public.sagadrive_build_program_presentation IS
  'Builds authoritative Program Output metadata (#365); strips secrets and forged keys.';

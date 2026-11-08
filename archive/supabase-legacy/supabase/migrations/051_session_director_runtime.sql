-- 051: Director Runtime / Cues / Automatic Mode (#375)
-- Production state: world_state.shared.director
-- Also expands session_events kind CHECK for life/adventure/cue.

ALTER TABLE public.session_events DROP CONSTRAINT IF EXISTS session_events_kind_check;
ALTER TABLE public.session_events
  ADD CONSTRAINT session_events_kind_check CHECK (kind IN (
    'join', 'leave', 'presence', 'status', 'roll', 'damage',
    'condition', 'scene', 'combat', 'gameplay', 'program', 'reveal',
    'life', 'adventure', 'cue'
  ));

ALTER TABLE public.session_players
  ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.session_players.capabilities IS
  'Additive session capabilities (e.g. director). Never a base role.';

CREATE OR REPLACE FUNCTION public.sagadrive_session_has_director(
  p_session_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.session_players sp
    WHERE sp.session_id = p_session_id
      AND sp.user_id = p_user_id
      AND jsonb_typeof(sp.capabilities) = 'array'
      AND sp.capabilities ? 'director'
  );
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_resolve_cue_command(
  p_payload JSONB,
  p_is_gm BOOLEAN,
  p_is_director BOOLEAN,
  p_world JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_in JSONB := COALESCE(p_payload, '{}'::jsonb);
  v_world JSONB := COALESCE(p_world, '{}'::jsonb);
  v_shared JSONB := COALESCE(v_world->'shared', '{}'::jsonb);
  v_op TEXT;
  v_dir JSONB;
  v_mode TEXT;
  v_trigger TEXT;
  v_manual BOOLEAN;
  v_source JSONB;
  v_layout JSONB;
  v_overlay TEXT;
  v_rev INT;
  v_cue JSONB;
  v_program JSONB;
  v_event JSONB;
  v_applied BOOLEAN := true;
  v_reason TEXT := NULL;
BEGIN
  IF NOT p_is_gm AND NOT p_is_director THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(v_shared) IS DISTINCT FROM 'object' THEN
    v_shared := '{}'::jsonb;
  END IF;

  -- Reject secret bodies in cue payload
  IF v_in ? 'gm_only' OR v_in ? 'character_specific' THEN
    RAISE EXCEPTION 'Cue payload darf keine Secrets enthalten' USING ERRCODE = '22023';
  END IF;

  v_op := COALESCE(NULLIF(BTRIM(COALESCE(v_in->>'op', '')), ''), 'apply_cue');
  v_dir := COALESCE(v_shared->'director', jsonb_build_object(
    'schemaVersion', 1,
    'automaticMode', 'off',
    'preview', jsonb_build_object(
      'source', jsonb_build_object('kind', 'shared-scene'),
      'layout', jsonb_build_object('kind', 'fullscreen-16x9')
    ),
    'program', jsonb_build_object(
      'source', jsonb_build_object('kind', 'shared-scene'),
      'layout', jsonb_build_object('kind', 'fullscreen-16x9'),
      'revision', 0
    ),
    'lastCue', NULL,
    'lastManualOverrideAt', NULL,
    'cooldownMs', 1500,
    'lastAutoAppliedAt', NULL,
    'updatedAt', NULL
  ));

  IF v_op = 'set_automatic_mode' THEN
    v_mode := CASE WHEN v_in->>'mode' = 'on' THEN 'on' ELSE 'off' END;
    v_dir := jsonb_set(v_dir, '{automaticMode}', to_jsonb(v_mode), true);
    v_dir := jsonb_set(v_dir, '{updatedAt}', to_jsonb(NOW()), true);
    v_shared := jsonb_set(v_shared, '{director}', v_dir, true);
    v_world := jsonb_set(v_world, '{shared}', v_shared, true);
    RETURN jsonb_build_object(
      'worldState', v_world,
      'eventPayload', jsonb_build_object('op', v_op, 'mode', v_mode, 'authoritative', true)
    );
  END IF;

  IF v_op = 'set_preview' THEN
    v_source := COALESCE(v_in->'source', jsonb_build_object('kind', 'shared-scene'));
    v_layout := COALESCE(v_in->'layout', jsonb_build_object('kind', 'fullscreen-16x9'));
    v_dir := jsonb_set(
      v_dir,
      '{preview}',
      jsonb_build_object('source', v_source, 'layout', v_layout),
      true
    );
    v_dir := jsonb_set(v_dir, '{updatedAt}', to_jsonb(NOW()), true);
    v_shared := jsonb_set(v_shared, '{director}', v_dir, true);
    v_world := jsonb_set(v_world, '{shared}', v_shared, true);
    RETURN jsonb_build_object(
      'worldState', v_world,
      'eventPayload', jsonb_build_object('op', v_op, 'authoritative', true)
    );
  END IF;

  -- apply_cue / take_preview_to_program
  v_trigger := COALESCE(NULLIF(BTRIM(COALESCE(v_in->>'trigger', '')), ''), 'manual');
  v_manual := COALESCE((v_in->>'manual')::boolean, v_trigger = 'manual', true);

  IF v_op = 'take_preview_to_program' THEN
    v_source := COALESCE(v_dir->'preview'->'source', jsonb_build_object('kind', 'shared-scene'));
    v_layout := COALESCE(v_dir->'preview'->'layout', jsonb_build_object('kind', 'fullscreen-16x9'));
    v_trigger := 'manual';
    v_manual := true;
    v_overlay := NULL;
  ELSE
    IF NOT v_manual THEN
      IF COALESCE(v_dir->>'automaticMode', 'off') IS DISTINCT FROM 'on' THEN
        v_applied := false;
        v_reason := 'automatic_mode_off';
      ELSIF v_dir->>'lastAutoAppliedAt' IS NOT NULL
        AND (EXTRACT(EPOCH FROM (NOW() - (v_dir->>'lastAutoAppliedAt')::timestamptz)) * 1000)
            < COALESCE((v_dir->>'cooldownMs')::int, 1500) THEN
        v_applied := false;
        v_reason := 'cooldown';
      END IF;
    END IF;
    v_source := COALESCE(v_in->'source', jsonb_build_object('kind', 'shared-scene'));
    v_layout := COALESCE(v_in->'layout', jsonb_build_object('kind', 'fullscreen-16x9'));
    v_overlay := NULLIF(BTRIM(COALESCE(v_in->>'overlayText', v_in->>'note', '')), '');
  END IF;

  IF NOT v_applied THEN
    v_shared := jsonb_set(v_shared, '{director}', v_dir, true);
    v_world := jsonb_set(v_world, '{shared}', v_shared, true);
    RETURN jsonb_build_object(
      'worldState', v_world,
      'eventPayload', jsonb_build_object(
        'op', 'apply_cue',
        'applied', false,
        'reason', v_reason,
        'trigger', v_trigger,
        'authoritative', true
      )
    );
  END IF;

  v_rev := GREATEST(0, COALESCE((v_dir->'program'->>'revision')::int, 0)) + 1;
  v_cue := jsonb_build_object(
    'id', 'cue-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
    'trigger', v_trigger,
    'source', v_source,
    'layout', v_layout,
    'overlayText', to_jsonb(v_overlay),
    'manual', v_manual,
    'appliedAt', NOW()
  );
  v_dir := jsonb_set(
    v_dir,
    '{program}',
    jsonb_build_object('source', v_source, 'layout', v_layout, 'revision', v_rev),
    true
  );
  v_dir := jsonb_set(v_dir, '{lastCue}', v_cue, true);
  IF v_manual THEN
    v_dir := jsonb_set(v_dir, '{lastManualOverrideAt}', to_jsonb(NOW()), true);
  ELSE
    v_dir := jsonb_set(v_dir, '{lastAutoAppliedAt}', to_jsonb(NOW()), true);
  END IF;
  v_dir := jsonb_set(v_dir, '{updatedAt}', to_jsonb(NOW()), true);

  -- Push presentation-safe programPresentation (no secrets)
  v_program := public.sagadrive_build_program_presentation(
    jsonb_build_object(
      'source', CASE
        WHEN v_source->>'kind' = 'look' THEN v_source
        WHEN v_source->>'kind' = 'neutral' THEN jsonb_build_object('kind', 'neutral')
        ELSE jsonb_build_object('kind', 'shared-scene')
      END,
      'layout', CASE
        WHEN v_layout->>'kind' = 'letterbox' THEN jsonb_build_object('kind', 'letterbox')
        ELSE jsonb_build_object('kind', 'fullscreen-16x9')
      END,
      'overlay', CASE
        WHEN v_overlay IS NOT NULL THEN jsonb_build_object('kind', 'title', 'text', left(v_overlay, 120))
        ELSE NULL
      END
    ),
    COALESCE(v_shared->'programPresentation', NULL)
  );

  v_shared := jsonb_set(v_shared, '{director}', v_dir, true);
  v_shared := jsonb_set(v_shared, '{programPresentation}', v_program, true);
  v_world := jsonb_set(v_world, '{shared}', v_shared, true);

  v_event := jsonb_build_object(
    'op', v_op,
    'applied', true,
    'cue', v_cue,
    'programRevision', v_program->>'programRevision',
    'authoritative', true
  );
  RETURN jsonb_build_object('worldState', v_world, 'eventPayload', v_event);
END;
$$;

REVOKE ALL ON FUNCTION public.sagadrive_resolve_cue_command(JSONB, BOOLEAN, BOOLEAN, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sagadrive_resolve_cue_command(JSONB, BOOLEAN, BOOLEAN, JSONB) TO authenticated;

-- Patch apply for cue kind (director OR GM)
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
  v_is_director := public.sagadrive_session_has_director(p_session_id, actor);

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
  ELSIF p_kind = 'life' THEN
    v_life := public.sagadrive_resolve_life_command(p_payload, v_is_gm, v_world);
    v_event_payload := v_life->'eventPayload';
    v_world := v_life->'worldState';
  ELSIF p_kind = 'adventure' THEN
    v_adventure := public.sagadrive_resolve_adventure_command(
      p_session_id, p_payload, v_is_gm, v_world
    );
    v_event_payload := v_adventure->'eventPayload';
    v_world := v_adventure->'worldState';
  ELSIF p_kind = 'cue' THEN
    v_cue := public.sagadrive_resolve_cue_command(p_payload, v_is_gm, v_is_director, v_world);
    v_event_payload := v_cue->'eventPayload';
    v_world := v_cue->'worldState';
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
    IF NOT v_is_gm AND NOT v_is_director THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    v_program := public.sagadrive_build_program_presentation(
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
    v_knowledge := public.sagadrive_apply_knowledge_reveal(v_world, p_payload, actor);
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

REVOKE ALL ON FUNCTION public.apply_session_runtime_command(UUID, BIGINT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_session_runtime_command(UUID, BIGINT, TEXT, JSONB, TEXT) TO authenticated;

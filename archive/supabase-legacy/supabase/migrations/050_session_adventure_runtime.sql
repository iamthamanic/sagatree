-- 050: Typed Adventure Runtime / persistent World State (#374)
-- Session: world_state.shared.adventure
-- Saga continuity: projects.adventure_runtime (definitionRef never mutates definitions)

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS adventure_runtime JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.projects.adventure_runtime IS
  'Durable typed adventure playthrough (#374); not adventure definition bodies.';

CREATE OR REPLACE FUNCTION public.sagadrive_empty_adventure_runtime()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'schemaVersion', 1,
    'definitionRef', NULL,
    'flags', '{}'::jsonb,
    'relationships', '{}'::jsonb,
    'clocks', '{}'::jsonb,
    'consequences', '[]'::jsonb,
    'sliceRevision', 0,
    'updatedAt', NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_resolve_adventure_command(
  p_session_id UUID,
  p_payload JSONB,
  p_is_gm BOOLEAN,
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
  v_adv JSONB;
  v_project UUID;
  v_project_adv JSONB;
  v_key TEXT;
  v_value JSONB;
  v_vis TEXT;
  v_flags JSONB;
  v_clocks JSONB;
  v_clock JSONB;
  v_clock_id TEXT;
  v_max INT;
  v_val INT;
  v_delta INT;
  v_rel JSONB;
  v_rel_id TEXT;
  v_cons JSONB;
  v_id TEXT;
  v_event JSONB;
  v_rev INT;
BEGIN
  IF NOT p_is_gm THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(v_shared) IS DISTINCT FROM 'object' THEN
    v_shared := '{}'::jsonb;
  END IF;

  v_op := NULLIF(BTRIM(COALESCE(v_in->>'op', '')), '');
  IF v_op IS NULL AND NULLIF(BTRIM(COALESCE(v_in->>'key', '')), '') IS NOT NULL THEN
    v_op := 'set_flag';
  END IF;
  IF v_op IS NULL THEN
    RAISE EXCEPTION 'Adventure-op erforderlich' USING ERRCODE = '22023';
  END IF;

  SELECT project_id INTO v_project FROM public.sessions WHERE id = p_session_id;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT COALESCE(adventure_runtime, '{}'::jsonb) INTO v_project_adv
  FROM public.projects WHERE id = v_project;

  v_adv := COALESCE(v_shared->'adventure', public.sagadrive_empty_adventure_runtime());
  IF jsonb_typeof(v_adv) IS DISTINCT FROM 'object' THEN
    v_adv := public.sagadrive_empty_adventure_runtime();
  END IF;
  IF COALESCE((v_adv->>'schemaVersion')::int, 0) <> 1 THEN
    v_adv := public.sagadrive_empty_adventure_runtime() || jsonb_build_object(
      'definitionRef', v_adv->'definitionRef'
    );
  END IF;

  IF v_op = 'hydrate_from_project' THEN
    IF jsonb_typeof(v_project_adv) = 'object' AND COALESCE((v_project_adv->>'schemaVersion')::int, 0) = 1 THEN
      v_adv := v_project_adv;
    ELSE
      v_adv := public.sagadrive_empty_adventure_runtime();
    END IF;
  ELSIF v_op = 'set_definition_ref' THEN
    IF NULLIF(BTRIM(COALESCE(v_in->>'definitionRef', '')), '') IS NULL THEN
      RAISE EXCEPTION 'definitionRef erforderlich' USING ERRCODE = '22023';
    END IF;
    v_adv := jsonb_set(v_adv, '{definitionRef}', to_jsonb(left(v_in->>'definitionRef', 120)), true);
  ELSIF v_op = 'set_flag' THEN
    v_key := NULLIF(BTRIM(COALESCE(v_in->>'key', '')), '');
    IF v_key IS NULL THEN
      RAISE EXCEPTION 'key erforderlich' USING ERRCODE = '22023';
    END IF;
    v_key := left(v_key, 64);
    v_vis := COALESCE(NULLIF(BTRIM(COALESCE(v_in->>'visibility', '')), ''), 'shared');
    IF v_vis NOT IN ('public', 'shared', 'gm_only') THEN
      v_vis := 'shared';
    END IF;
    IF v_in ? 'value' THEN
      v_value := v_in->'value';
    ELSE
      v_value := 'true'::jsonb;
    END IF;
    v_flags := COALESCE(v_adv->'flags', '{}'::jsonb);
    v_flags := jsonb_set(
      v_flags,
      ARRAY[v_key],
      jsonb_build_object(
        'key', v_key,
        'value', v_value,
        'visibility', v_vis,
        'updatedAt', NOW()
      ),
      true
    );
    v_adv := jsonb_set(v_adv, '{flags}', v_flags, true);
  ELSIF v_op = 'set_relationship' THEN
    IF NULLIF(BTRIM(COALESCE(v_in->>'actorRef', '')), '') IS NULL
       OR NULLIF(BTRIM(COALESCE(v_in->>'targetRef', '')), '') IS NULL THEN
      RAISE EXCEPTION 'actorRef und targetRef erforderlich' USING ERRCODE = '22023';
    END IF;
    v_rel_id := left((v_in->>'actorRef') || '->' || (v_in->>'targetRef'), 64);
    v_vis := COALESCE(NULLIF(BTRIM(COALESCE(v_in->>'visibility', '')), ''), 'gm_only');
    IF v_vis NOT IN ('public', 'shared', 'gm_only') THEN
      v_vis := 'gm_only';
    END IF;
    v_rel := COALESCE(v_adv->'relationships', '{}'::jsonb);
    v_rel := jsonb_set(
      v_rel,
      ARRAY[v_rel_id],
      jsonb_build_object(
        'actorRef', left(v_in->>'actorRef', 80),
        'targetRef', left(v_in->>'targetRef', 80),
        'score', GREATEST(-100, LEAST(100, COALESCE((v_in->>'score')::int, 0))),
        'note', left(COALESCE(v_in->>'note', ''), 200),
        'visibility', v_vis
      ),
      true
    );
    v_adv := jsonb_set(v_adv, '{relationships}', v_rel, true);
  ELSIF v_op = 'tick_clock' THEN
    v_clock_id := left(COALESCE(NULLIF(BTRIM(COALESCE(v_in->>'clockId', '')), ''), 'danger'), 64);
    v_clocks := COALESCE(v_adv->'clocks', '{}'::jsonb);
    v_clock := COALESCE(v_clocks->v_clock_id, '{}'::jsonb);
    v_max := GREATEST(1, LEAST(12, COALESCE((v_in->>'clockMax')::int, (v_clock->>'max')::int, 4)));
    v_delta := COALESCE((v_in->>'clockDelta')::int, 1);
    v_val := GREATEST(0, LEAST(v_max, COALESCE((v_clock->>'value')::int, 0) + v_delta));
    v_vis := COALESCE(NULLIF(BTRIM(COALESCE(v_in->>'visibility', '')), ''), COALESCE(v_clock->>'visibility', 'shared'));
    IF v_vis NOT IN ('public', 'shared', 'gm_only') THEN
      v_vis := 'shared';
    END IF;
    v_clocks := jsonb_set(
      v_clocks,
      ARRAY[v_clock_id],
      jsonb_build_object(
        'id', v_clock_id,
        'label', left(COALESCE(NULLIF(BTRIM(COALESCE(v_in->>'clockLabel', '')), ''), v_clock->>'label', v_clock_id), 80),
        'value', v_val,
        'max', v_max,
        'visibility', v_vis
      ),
      true
    );
    v_adv := jsonb_set(v_adv, '{clocks}', v_clocks, true);
  ELSIF v_op = 'add_consequence' THEN
    IF NULLIF(BTRIM(COALESCE(v_in->>'summary', '')), '') IS NULL THEN
      RAISE EXCEPTION 'summary erforderlich' USING ERRCODE = '22023';
    END IF;
    v_vis := COALESCE(NULLIF(BTRIM(COALESCE(v_in->>'visibility', '')), ''), 'shared');
    IF v_vis NOT IN ('public', 'shared', 'gm_only') THEN
      v_vis := 'shared';
    END IF;
    v_id := 'c-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    v_cons := COALESCE(v_adv->'consequences', '[]'::jsonb);
    IF jsonb_typeof(v_cons) IS DISTINCT FROM 'array' THEN
      v_cons := '[]'::jsonb;
    END IF;
    v_cons := v_cons || jsonb_build_array(jsonb_build_object(
      'id', v_id,
      'kind', left(COALESCE(NULLIF(BTRIM(COALESCE(v_in->>'consequenceKind', '')), ''), 'generic'), 40),
      'summary', left(v_in->>'summary', 200),
      'visibility', v_vis,
      'createdAt', NOW()
    ));
    -- keep last 64
    IF jsonb_array_length(v_cons) > 64 THEN
      v_cons := (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM (
          SELECT elem FROM jsonb_array_elements(v_cons) AS elem
          OFFSET GREATEST(jsonb_array_length(v_cons) - 64, 0)
        ) s
      );
    END IF;
    v_adv := jsonb_set(v_adv, '{consequences}', v_cons, true);
  ELSIF v_op = 'persist_to_project' THEN
    -- no-op on session state; persistence below
    NULL;
  ELSE
    RAISE EXCEPTION 'Unbekannte Adventure-Operation' USING ERRCODE = '22023';
  END IF;

  v_rev := GREATEST(0, COALESCE((v_adv->>'sliceRevision')::int, 0)) + 1;
  v_adv := jsonb_set(v_adv, '{schemaVersion}', '1'::jsonb, true);
  v_adv := jsonb_set(v_adv, '{sliceRevision}', to_jsonb(v_rev), true);
  v_adv := jsonb_set(v_adv, '{updatedAt}', to_jsonb(NOW()), true);

  v_shared := jsonb_set(v_shared, '{adventure}', v_adv, true);
  v_world := jsonb_set(v_world, '{shared}', v_shared, true);

  -- Saga continuity: durable project snapshot (never writes into definition tables)
  IF v_op IS DISTINCT FROM 'hydrate_from_project' OR v_in->>'forcePersist' = 'true' THEN
    IF v_op IN (
      'set_flag', 'set_relationship', 'tick_clock', 'add_consequence',
      'set_definition_ref', 'persist_to_project'
    ) THEN
      UPDATE public.projects
         SET adventure_runtime = v_adv,
             updated_at = NOW()
       WHERE id = v_project;
    END IF;
  END IF;

  v_event := jsonb_build_object(
    'op', v_op,
    'key', v_in->>'key',
    'definitionRef', v_adv->>'definitionRef',
    'sliceRevision', v_rev,
    'authoritative', true
  );
  RETURN jsonb_build_object('worldState', v_world, 'eventPayload', v_event);
END;
$$;

REVOKE ALL ON FUNCTION public.sagadrive_resolve_adventure_command(UUID, JSONB, BOOLEAN, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sagadrive_resolve_adventure_command(UUID, JSONB, BOOLEAN, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.sagadrive_project_shared_adventure(
  p_shared JSONB,
  p_is_gm BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_adv JSONB;
  v_flags JSONB := '{}'::jsonb;
  v_rels JSONB := '{}'::jsonb;
  v_clocks JSONB := '{}'::jsonb;
  v_cons JSONB := '[]'::jsonb;
  v_key TEXT;
  v_entry JSONB;
  v_vis TEXT;
BEGIN
  IF p_shared IS NULL OR NOT (p_shared ? 'adventure') THEN
    RETURN COALESCE(p_shared, '{}'::jsonb);
  END IF;
  IF p_is_gm THEN
    RETURN p_shared;
  END IF;
  v_adv := p_shared->'adventure';
  IF jsonb_typeof(v_adv) <> 'object' THEN
    RETURN p_shared - 'adventure';
  END IF;

  FOR v_key, v_entry IN SELECT * FROM jsonb_each(COALESCE(v_adv->'flags', '{}'::jsonb))
  LOOP
    v_vis := COALESCE(v_entry->>'visibility', 'gm_only');
    IF v_vis IN ('public', 'shared') THEN
      v_flags := jsonb_set(v_flags, ARRAY[v_key], v_entry, true);
    END IF;
  END LOOP;

  FOR v_key, v_entry IN SELECT * FROM jsonb_each(COALESCE(v_adv->'relationships', '{}'::jsonb))
  LOOP
    v_vis := COALESCE(v_entry->>'visibility', 'gm_only');
    IF v_vis IN ('public', 'shared') THEN
      v_rels := jsonb_set(v_rels, ARRAY[v_key], v_entry, true);
    END IF;
  END LOOP;

  FOR v_key, v_entry IN SELECT * FROM jsonb_each(COALESCE(v_adv->'clocks', '{}'::jsonb))
  LOOP
    v_vis := COALESCE(v_entry->>'visibility', 'gm_only');
    IF v_vis IN ('public', 'shared') THEN
      v_clocks := jsonb_set(v_clocks, ARRAY[v_key], v_entry, true);
    END IF;
  END LOOP;

  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    INTO v_cons
    FROM jsonb_array_elements(COALESCE(v_adv->'consequences', '[]'::jsonb)) AS elem
   WHERE COALESCE(elem->>'visibility', 'gm_only') IN ('public', 'shared');

  v_adv := jsonb_set(v_adv, '{flags}', v_flags, true);
  v_adv := jsonb_set(v_adv, '{relationships}', v_rels, true);
  v_adv := jsonb_set(v_adv, '{clocks}', v_clocks, true);
  v_adv := jsonb_set(v_adv, '{consequences}', v_cons, true);
  RETURN jsonb_set(p_shared, '{adventure}', v_adv, true);
END;
$$;

-- Patch apply_session_runtime_command: accept adventure kind
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
  v_knowledge JSONB;
  v_life JSONB;
  v_adventure JSONB;
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
    'condition', 'scene', 'combat', 'gameplay', 'program', 'reveal', 'life', 'adventure'
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

CREATE OR REPLACE FUNCTION public.get_session_runtime_snapshot(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

  v_shared := public.sagadrive_project_shared_knowledge(
    COALESCE(v_session.world_state->'shared', '{}'::jsonb),
    v_is_gm,
    v_character_id
  );
  v_shared := public.sagadrive_project_shared_adventure(v_shared, v_is_gm);

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

REVOKE ALL ON FUNCTION public.get_session_runtime_snapshot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_session_runtime_snapshot(UUID) TO authenticated;

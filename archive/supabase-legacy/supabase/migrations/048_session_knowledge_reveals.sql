-- 048_session_knowledge_reveals.sql
-- Knowledge / Secrets / Reveals (#367): world_state.shared.knowledge + event kind reveal.

ALTER TABLE public.session_events DROP CONSTRAINT IF EXISTS session_events_kind_check;
ALTER TABLE public.session_events
  ADD CONSTRAINT session_events_kind_check CHECK (kind IN (
    'join', 'leave', 'presence', 'status', 'roll', 'damage',
    'condition', 'scene', 'combat', 'gameplay', 'program', 'reveal'
  ));

CREATE OR REPLACE FUNCTION public.sagadrive_apply_knowledge_reveal(
  p_world JSONB,
  p_payload JSONB,
  p_actor UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_shared JSONB;
  v_knowledge JSONB;
  v_facts JSONB;
  v_fact JSONB;
  v_fact_id TEXT;
  v_target JSONB;
  v_target_kind TEXT;
  v_character_id TEXT;
  v_reveals JSONB;
  v_discoveries JSONB;
  v_reveal JSONB;
  v_found BOOLEAN := FALSE;
  v_i INT;
BEGIN
  p_payload := COALESCE(p_payload, '{}'::jsonb);
  v_fact_id := NULLIF(BTRIM(COALESCE(p_payload->>'factId', '')), '');
  IF v_fact_id IS NULL THEN
    RAISE EXCEPTION 'factId ist erforderlich' USING ERRCODE = '22023';
  END IF;
  v_fact_id := left(v_fact_id, 128);

  v_target := p_payload->'target';
  IF v_target IS NULL OR jsonb_typeof(v_target) <> 'object' THEN
    RAISE EXCEPTION 'Reveal-Target ungültig' USING ERRCODE = '22023';
  END IF;
  v_target_kind := NULLIF(BTRIM(COALESCE(v_target->>'kind', '')), '');
  IF v_target_kind NOT IN ('everyone', 'program', 'players', 'character') THEN
    RAISE EXCEPTION 'Reveal-Target ungültig' USING ERRCODE = '22023';
  END IF;
  IF v_target_kind = 'character' THEN
    v_character_id := NULLIF(BTRIM(COALESCE(v_target->>'characterId', '')), '');
    IF v_character_id IS NULL THEN
      RAISE EXCEPTION 'characterId ist erforderlich' USING ERRCODE = '22023';
    END IF;
    v_character_id := left(v_character_id, 128);
    v_target := jsonb_build_object('kind', 'character', 'characterId', v_character_id);
  ELSE
    v_target := jsonb_build_object('kind', v_target_kind);
  END IF;

  v_shared := COALESCE(p_world->'shared', '{}'::jsonb);
  v_knowledge := COALESCE(v_shared->'knowledge', '{}'::jsonb);
  IF COALESCE(v_knowledge->>'authoritative', 'false') <> 'true' THEN
    v_knowledge := jsonb_build_object(
      'schemaVersion', 1,
      'authoritative', true,
      'facts', '[]'::jsonb,
      'discoveries', '[]'::jsonb,
      'reveals', '[]'::jsonb,
      'updatedAt', to_jsonb(NOW() AT TIME ZONE 'utc')
    );
  END IF;

  v_facts := COALESCE(v_knowledge->'facts', '[]'::jsonb);
  IF jsonb_typeof(v_facts) = 'array' THEN
    FOR v_i IN 0 .. GREATEST(jsonb_array_length(v_facts) - 1, -1) LOOP
      IF v_facts->v_i->>'id' = v_fact_id THEN
        v_found := TRUE;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Upsert minimal fact stub if GM reveals an unpublished id with title/body in payload.
  IF NOT v_found THEN
    v_fact := jsonb_build_object(
      'id', v_fact_id,
      'title', left(COALESCE(NULLIF(BTRIM(p_payload->>'title'), ''), v_fact_id), 160),
      'visibility', COALESCE(NULLIF(BTRIM(p_payload->>'visibility'), ''), 'gm_only'),
      'body', to_jsonb(left(COALESCE(p_payload->>'body', ''), 4000)),
      'handoutRef', 'null'::jsonb,
      'characterId', to_jsonb(
        NULLIF(left(BTRIM(COALESCE(p_payload->>'characterId', '')), 128), '')
      )
    );
    IF v_fact->>'visibility' NOT IN (
      'public', 'gm_only', 'discovered', 'character_specific', 'program'
    ) THEN
      v_fact := jsonb_set(v_fact, '{visibility}', '"gm_only"'::jsonb, true);
    END IF;
    v_facts := v_facts || jsonb_build_array(v_fact);
  END IF;

  v_reveal := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'factId', v_fact_id,
    'target', v_target,
    'revealedAt', to_jsonb(NOW() AT TIME ZONE 'utc'),
    'byUserId', to_jsonb(p_actor::text)
  );
  v_reveals := COALESCE(v_knowledge->'reveals', '[]'::jsonb) || jsonb_build_array(v_reveal);

  v_discoveries := COALESCE(v_knowledge->'discoveries', '[]'::jsonb);
  IF v_target_kind IN ('everyone', 'players', 'character') THEN
    v_found := FALSE;
    IF jsonb_typeof(v_discoveries) = 'array' THEN
      FOR v_i IN 0 .. GREATEST(jsonb_array_length(v_discoveries) - 1, -1) LOOP
        IF v_discoveries->v_i->>'factId' = v_fact_id THEN
          v_found := TRUE;
          EXIT;
        END IF;
      END LOOP;
    END IF;
    IF NOT v_found THEN
      v_discoveries := v_discoveries || jsonb_build_array(jsonb_build_object(
        'factId', v_fact_id,
        'discoveredAt', to_jsonb(NOW() AT TIME ZONE 'utc'),
        'byUserId', to_jsonb(p_actor::text)
      ));
    END IF;
  END IF;

  v_knowledge := jsonb_build_object(
    'schemaVersion', 1,
    'authoritative', true,
    'facts', v_facts,
    'discoveries', v_discoveries,
    'reveals', v_reveals,
    'updatedAt', to_jsonb(NOW() AT TIME ZONE 'utc')
  );
  v_shared := jsonb_set(v_shared, '{knowledge}', v_knowledge, true);
  RETURN jsonb_build_object(
    'worldState', jsonb_set(COALESCE(p_world, '{}'::jsonb), '{shared}', v_shared, true),
    'eventPayload', v_reveal
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
  v_knowledge JSONB;
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
    'condition', 'scene', 'combat', 'gameplay', 'program', 'reveal'
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

COMMENT ON FUNCTION public.sagadrive_apply_knowledge_reveal IS
  'Authoritative knowledge reveal into shared.knowledge (#367); GM-only via apply_session_runtime_command.';

-- Project shared.knowledge for non-GM: strip unauthorized secret bodies (not CSS hide).
CREATE OR REPLACE FUNCTION public.sagadrive_project_shared_knowledge(
  p_shared JSONB,
  p_is_gm BOOLEAN,
  p_character_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_knowledge JSONB;
  v_facts JSONB := '[]'::jsonb;
  v_fact JSONB;
  v_out JSONB;
  v_vis TEXT;
  v_body_allowed BOOLEAN;
  v_revealed BOOLEAN;
  v_i INT;
  v_reveals JSONB;
  v_r JSONB;
  v_j INT;
  v_char TEXT;
BEGIN
  IF p_shared IS NULL OR NOT (p_shared ? 'knowledge') THEN
    RETURN COALESCE(p_shared, '{}'::jsonb);
  END IF;
  IF p_is_gm THEN
    RETURN p_shared;
  END IF;

  v_knowledge := p_shared->'knowledge';
  IF jsonb_typeof(v_knowledge) <> 'object' THEN
    RETURN p_shared - 'knowledge';
  END IF;

  v_reveals := COALESCE(v_knowledge->'reveals', '[]'::jsonb);
  v_char := CASE WHEN p_character_id IS NULL THEN NULL ELSE p_character_id::text END;

  IF jsonb_typeof(v_knowledge->'facts') = 'array' THEN
    FOR v_i IN 0 .. GREATEST(jsonb_array_length(v_knowledge->'facts') - 1, -1) LOOP
      v_fact := v_knowledge->'facts'->v_i;
      v_vis := COALESCE(v_fact->>'visibility', 'gm_only');
      v_revealed := FALSE;
      IF jsonb_typeof(v_reveals) = 'array' THEN
        FOR v_j IN 0 .. GREATEST(jsonb_array_length(v_reveals) - 1, -1) LOOP
          v_r := v_reveals->v_j;
          IF v_r->>'factId' = v_fact->>'id' THEN
            IF v_r->'target'->>'kind' IN ('everyone', 'program', 'players') THEN
              v_revealed := TRUE;
            ELSIF v_r->'target'->>'kind' = 'character'
              AND v_char IS NOT NULL
              AND v_r->'target'->>'characterId' = v_char THEN
              v_revealed := TRUE;
            END IF;
          END IF;
        END LOOP;
      END IF;

      v_body_allowed := FALSE;
      IF v_vis = 'public' OR v_vis = 'program' THEN
        v_body_allowed := TRUE;
      ELSIF v_vis = 'discovered' AND (
        v_revealed OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(v_knowledge->'discoveries', '[]'::jsonb)) d
          WHERE d->>'factId' = v_fact->>'id'
        )
      ) THEN
        v_body_allowed := TRUE;
      ELSIF v_vis = 'character_specific' AND v_char IS NOT NULL AND v_fact->>'characterId' = v_char THEN
        v_body_allowed := TRUE;
      ELSIF v_vis = 'gm_only' AND v_revealed THEN
        v_body_allowed := TRUE;
      END IF;

      -- Hide gm_only facts entirely until revealed.
      IF v_vis = 'gm_only' AND NOT v_revealed THEN
        CONTINUE;
      END IF;
      IF v_vis = 'character_specific' AND (v_char IS NULL OR v_fact->>'characterId' IS DISTINCT FROM v_char) AND NOT v_revealed THEN
        CONTINUE;
      END IF;

      IF NOT v_body_allowed THEN
        v_fact := jsonb_set(v_fact, '{body}', 'null'::jsonb, true);
        v_fact := jsonb_set(v_fact, '{handoutRef}', 'null'::jsonb, true);
      END IF;
      v_facts := v_facts || jsonb_build_array(v_fact);
    END LOOP;
  END IF;

  v_out := jsonb_set(v_knowledge, '{facts}', v_facts, true);
  RETURN jsonb_set(p_shared, '{knowledge}', v_out, true);
END;
$$;

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

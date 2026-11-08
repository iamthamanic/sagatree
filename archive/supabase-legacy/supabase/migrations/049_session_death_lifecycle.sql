-- 049: Session death lifecycle — downed / stabilize / dead (#373)
-- Authoritative lifeByCharacter in world_state.shared; event kind `life`.
-- Reuses SagaDrive §8.5 / §16.4 semantics (mirrored in TS domain).

CREATE OR REPLACE FUNCTION public.sagadrive_life_start_level(p_difficulty TEXT, p_explicit_deadly BOOLEAN)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_difficulty = 'Heroisch' THEN
    IF p_explicit_deadly THEN
      RETURN 1;
    END IF;
    RETURN 0;
  ELSIF p_difficulty = 'Hart' THEN
    RETURN 2;
  END IF;
  RETURN 1; -- Standard
END;
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_life_conditions(p_status TEXT, p_dying INT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_dying INT := GREATEST(0, LEAST(3, COALESCE(p_dying, 0)));
  v_out JSONB := '[]'::jsonb;
BEGIN
  IF p_status = 'dead' THEN
    RETURN '["tot","kampfunfähig"]'::jsonb;
  ELSIF p_status = 'stable' THEN
    v_out := '["kampfunfähig","stabil"]'::jsonb;
    IF v_dying > 0 THEN
      v_out := v_out || to_jsonb(('sterbend:' || v_dying::text));
    END IF;
    RETURN v_out;
  ELSIF p_status = 'downed' THEN
    v_out := '["kampfunfähig","bewusstlos"]'::jsonb;
    IF v_dying > 0 THEN
      v_out := v_out || to_jsonb(('sterbend:' || v_dying::text));
    END IF;
    RETURN v_out;
  END IF;
  RETURN '[]'::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_merge_life_into_conditions(
  p_existing JSONB,
  p_life_conditions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_out JSONB := '[]'::jsonb;
  v_elem TEXT;
  v_count INT := 0;
BEGIN
  FOR v_elem IN SELECT jsonb_array_elements_text(COALESCE(p_existing, '[]'::jsonb))
  LOOP
    IF v_elem NOT IN ('tot', 'kampfunfähig', 'bewusstlos', 'unconscious', 'stabil')
       AND v_elem NOT LIKE 'sterbend:%' THEN
      v_out := v_out || to_jsonb(v_elem);
      v_count := v_count + 1;
      IF v_count >= 24 THEN
        RETURN v_out;
      END IF;
    END IF;
  END LOOP;
  FOR v_elem IN SELECT jsonb_array_elements_text(COALESCE(p_life_conditions, '[]'::jsonb))
  LOOP
    IF NOT (v_out @> to_jsonb(v_elem)) THEN
      v_out := v_out || to_jsonb(v_elem);
      v_count := v_count + 1;
      IF v_count >= 24 THEN
        RETURN v_out;
      END IF;
    END IF;
  END LOOP;
  RETURN v_out;
END;
$$;

-- Extend damage resolve: write lifeByCharacter on drop to 0 / heal from 0.
CREATE OR REPLACE FUNCTION public.sagadrive_resolve_damage_command(
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
  v_in JSONB := public.sagadrive_strip_forged_encounter_keys(p_payload);
  v_world JSONB := COALESCE(p_world, '{}'::jsonb);
  v_shared JSONB := COALESCE(v_world->'shared', '{}'::jsonb);
  v_encounter JSONB;
  v_participants JSONB;
  v_pid TEXT;
  v_mode TEXT;
  v_amount INT;
  v_i INT;
  v_len INT;
  v_participant JSONB;
  v_hp INT;
  v_max INT;
  v_prev INT;
  v_conditions JSONB;
  v_event JSONB;
  v_ref TEXT;
  v_diff TEXT;
  v_life JSONB;
  v_prev_life JSONB;
  v_wounds INT;
  v_start INT;
  v_status TEXT;
  v_dying INT;
  v_life_conds JSONB;
BEGIN
  IF NOT p_is_gm THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(v_shared) IS DISTINCT FROM 'object' THEN
    v_shared := '{}'::jsonb;
  END IF;
  v_encounter := COALESCE(v_shared->'encounter', '{}'::jsonb);
  IF COALESCE(v_encounter->>'status', '') IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Kein aktiver Encounter' USING ERRCODE = '22023';
  END IF;

  v_pid := NULLIF(BTRIM(COALESCE(v_in->>'participantId', '')), '');
  v_mode := COALESCE(NULLIF(BTRIM(COALESCE(v_in->>'mode', '')), ''), 'damage');
  IF v_mode NOT IN ('damage', 'heal') THEN
    RAISE EXCEPTION 'Ungültiger Schaden-Modus' USING ERRCODE = '22023';
  END IF;
  IF v_pid IS NULL OR NOT ((v_in->>'amount') ~ '^[0-9]+$') THEN
    RAISE EXCEPTION 'Schaden/Heilung benötigt participantId und Betrag' USING ERRCODE = '22023';
  END IF;
  v_amount := (v_in->>'amount')::int;
  IF v_amount < 0 OR v_amount > 9999 THEN
    RAISE EXCEPTION 'Ungültiger Betrag' USING ERRCODE = '22023';
  END IF;

  v_participants := COALESCE(v_encounter->'participants', '[]'::jsonb);
  v_len := jsonb_array_length(v_participants);
  v_participant := NULL;
  FOR v_i IN 0 .. v_len - 1 LOOP
    IF (v_participants->v_i->>'id') = v_pid THEN
      v_participant := v_participants->v_i;
      EXIT;
    END IF;
  END LOOP;
  IF v_participant IS NULL THEN
    RAISE EXCEPTION 'Teilnehmer nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  v_max := GREATEST(1, COALESCE((v_participant->>'hpMax')::int, 1));
  v_prev := COALESCE((v_participant->>'hpCurrent')::int, v_max);
  IF v_mode = 'damage' THEN
    v_hp := GREATEST(0, v_prev - v_amount);
  ELSE
    v_hp := LEAST(v_max, v_prev + v_amount);
  END IF;
  v_participant := jsonb_set(v_participant, '{hpCurrent}', to_jsonb(v_hp), true);

  v_conditions := COALESCE(v_participant->'conditions', '[]'::jsonb);
  -- Legacy #300: bewusstlos on drop to 0 / clear on heal (kept for tests + UI)
  IF v_mode = 'damage' AND v_prev > 0 AND v_hp = 0 THEN
    IF NOT (v_conditions @> '"bewusstlos"'::jsonb) THEN
      v_conditions := v_conditions || '"bewusstlos"'::jsonb;
    END IF;
  ELSIF v_mode = 'heal' AND v_prev = 0 AND v_hp > 0 THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(elem)), '[]'::jsonb)
      INTO v_conditions
      FROM jsonb_array_elements_text(v_conditions) AS elem
     WHERE elem NOT IN ('bewusstlos', 'unconscious');
  END IF;

  -- Life track (#373) for PCs (refId = character uuid)
  v_ref := NULLIF(BTRIM(COALESCE(v_participant->>'refId', '')), '');
  v_diff := COALESCE(NULLIF(BTRIM(COALESCE(v_shared->>'lifeDifficulty', '')), ''), 'Standard');
  IF v_diff NOT IN ('Heroisch', 'Standard', 'Hart') THEN
    v_diff := 'Standard';
  END IF;
  IF v_participant->>'kind' = 'pc' AND v_ref IS NOT NULL THEN
    v_prev_life := COALESCE(v_shared->'lifeByCharacter'->v_ref, '{}'::jsonb);
    IF v_mode = 'damage' AND v_prev > 0 AND v_hp = 0 THEN
      IF COALESCE(v_prev_life->>'status', '') = 'dead' THEN
        v_life := v_prev_life;
      ELSE
        v_wounds := GREATEST(0, COALESCE((v_prev_life->>'wounds')::int, 0));
        v_start := public.sagadrive_life_start_level(v_diff, COALESCE((v_in->>'explicitDeadly')::boolean, false));
        IF v_diff = 'Hart' THEN
          IF v_wounds < 3 THEN
            v_wounds := v_wounds + 1;
          ELSE
            v_start := LEAST(3, v_start + 1);
          END IF;
        END IF;
        IF v_start >= 3 THEN
          v_status := 'dead';
          v_dying := 3;
        ELSIF v_start = 0 THEN
          v_status := 'stable';
          v_dying := 0;
        ELSE
          v_status := 'downed';
          v_dying := v_start;
        END IF;
        v_life := jsonb_build_object(
          'schemaVersion', 1,
          'status', v_status,
          'dyingLevel', v_dying,
          'wounds', v_wounds,
          'difficulty', v_diff,
          'updatedAt', NOW()
        );
      END IF;
      v_life_conds := public.sagadrive_life_conditions(v_life->>'status', (v_life->>'dyingLevel')::int);
      v_conditions := public.sagadrive_merge_life_into_conditions(v_conditions, v_life_conds);
      v_shared := jsonb_set(v_shared, ARRAY['lifeByCharacter', v_ref], v_life, true);
    ELSIF v_mode = 'heal' AND v_prev = 0 AND v_hp > 0 THEN
      IF COALESCE(v_prev_life->>'status', '') IS DISTINCT FROM 'dead' THEN
        v_life := jsonb_build_object(
          'schemaVersion', 1,
          'status', 'alive',
          'dyingLevel', 0,
          'wounds', GREATEST(0, COALESCE((v_prev_life->>'wounds')::int, 0)),
          'difficulty', COALESCE(v_prev_life->>'difficulty', v_diff),
          'updatedAt', NOW()
        );
        v_life_conds := public.sagadrive_life_conditions('alive', 0);
        v_conditions := public.sagadrive_merge_life_into_conditions(v_conditions, v_life_conds);
        v_shared := jsonb_set(v_shared, ARRAY['lifeByCharacter', v_ref], v_life, true);
      END IF;
    END IF;
  END IF;

  v_participant := jsonb_set(v_participant, '{conditions}', v_conditions, true);

  FOR v_i IN 0 .. v_len - 1 LOOP
    IF (v_participants->v_i->>'id') = v_pid THEN
      v_participants := jsonb_set(v_participants, ARRAY[v_i::text], v_participant, true);
      EXIT;
    END IF;
  END LOOP;

  v_encounter := jsonb_set(v_encounter, '{participants}', v_participants, true);
  v_shared := jsonb_set(v_shared, '{encounter}', v_encounter, true);
  IF v_participant->>'kind' = 'pc' AND v_ref IS NOT NULL THEN
    v_shared := jsonb_set(
      v_shared,
      ARRAY['hpByCharacter', v_ref],
      to_jsonb(v_hp),
      true
    );
    v_shared := jsonb_set(
      v_shared,
      ARRAY['conditionsByCharacter', v_ref],
      v_conditions,
      true
    );
  END IF;
  v_world := jsonb_set(v_world, '{shared}', v_shared, true);

  PERFORM public.sagadrive_sync_npc_instance_from_participant(v_participant);

  v_event := jsonb_build_object(
    'mode', v_mode,
    'participantId', v_pid,
    'amount', v_amount,
    'hpCurrent', v_hp,
    'hpMax', v_max,
    'authoritative', true,
    'lifeStatus', COALESCE(v_shared->'lifeByCharacter'->v_ref->>'status', NULL)
  );
  RETURN jsonb_build_object('worldState', v_world, 'eventPayload', v_event);
END;
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_resolve_life_command(
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
  v_char TEXT;
  v_pid TEXT;
  v_grade TEXT;
  v_diff TEXT;
  v_confirm BOOLEAN;
  v_note TEXT;
  v_prev JSONB;
  v_life JSONB;
  v_status TEXT;
  v_dying INT;
  v_wounds INT;
  v_life_conds JSONB;
  v_encounter JSONB;
  v_participants JSONB;
  v_participant JSONB;
  v_conditions JSONB;
  v_i INT;
  v_len INT;
  v_event JSONB;
BEGIN
  IF NOT p_is_gm THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(v_shared) IS DISTINCT FROM 'object' THEN
    v_shared := '{}'::jsonb;
  END IF;

  v_op := NULLIF(BTRIM(COALESCE(v_in->>'op', '')), '');
  v_char := NULLIF(BTRIM(COALESCE(v_in->>'characterId', '')), '');
  v_pid := NULLIF(BTRIM(COALESCE(v_in->>'participantId', '')), '');
  v_grade := NULLIF(BTRIM(COALESCE(v_in->>'grade', '')), '');
  v_diff := NULLIF(BTRIM(COALESCE(v_in->>'difficulty', '')), '');
  v_confirm := COALESCE((v_in->>'confirmDead')::boolean, false);
  v_note := left(NULLIF(BTRIM(COALESCE(v_in->>'note', '')), ''), 200);

  IF v_op IS NULL THEN
    RAISE EXCEPTION 'Life-op erforderlich' USING ERRCODE = '22023';
  END IF;

  IF v_op = 'set_difficulty' THEN
    IF v_diff IS NULL OR v_diff NOT IN ('Heroisch', 'Standard', 'Hart') THEN
      RAISE EXCEPTION 'Ungültige difficulty' USING ERRCODE = '22023';
    END IF;
    v_shared := jsonb_set(v_shared, '{lifeDifficulty}', to_jsonb(v_diff), true);
    v_world := jsonb_set(v_world, '{shared}', v_shared, true);
    RETURN jsonb_build_object(
      'worldState', v_world,
      'eventPayload', jsonb_build_object('op', 'set_difficulty', 'difficulty', v_diff, 'authoritative', true)
    );
  END IF;

  IF v_char IS NULL THEN
    RAISE EXCEPTION 'characterId erforderlich' USING ERRCODE = '22023';
  END IF;

  v_prev := COALESCE(v_shared->'lifeByCharacter'->v_char, '{}'::jsonb);
  v_status := COALESCE(v_prev->>'status', 'alive');
  v_dying := GREATEST(0, COALESCE((v_prev->>'dyingLevel')::int, 0));
  v_wounds := GREATEST(0, COALESCE((v_prev->>'wounds')::int, 0));
  v_diff := COALESCE(
    NULLIF(BTRIM(COALESCE(v_prev->>'difficulty', '')), ''),
    NULLIF(BTRIM(COALESCE(v_shared->>'lifeDifficulty', '')), ''),
    'Standard'
  );

  IF v_op = 'death_save' THEN
    IF v_status = 'dead' THEN
      RAISE EXCEPTION 'Charakter ist bereits tot' USING ERRCODE = '22023';
    END IF;
    IF v_status IS DISTINCT FROM 'downed' THEN
      RAISE EXCEPTION 'Todeswurf nur bei Sterbend' USING ERRCODE = '22023';
    END IF;
    IF v_grade IS NULL OR v_grade NOT IN ('crit_success', 'success', 'failure', 'crit_failure') THEN
      RAISE EXCEPTION 'grade erforderlich' USING ERRCODE = '22023';
    END IF;
    IF v_grade = 'crit_success' THEN
      v_status := 'stable';
      v_dying := 0;
    ELSIF v_grade = 'success' THEN
      v_dying := GREATEST(0, v_dying - 1);
      v_status := CASE WHEN v_dying = 0 THEN 'stable' ELSE 'downed' END;
    ELSIF v_grade = 'failure' THEN
      v_dying := v_dying + 1;
      v_status := 'downed';
    ELSE
      v_dying := v_dying + 2;
      v_status := 'downed';
    END IF;
    IF v_dying >= 3 THEN
      v_status := 'dead';
      v_dying := 3;
    END IF;
  ELSIF v_op = 'stabilize' THEN
    IF v_status = 'dead' THEN
      RAISE EXCEPTION 'Tote können nicht stabilisiert werden' USING ERRCODE = '22023';
    END IF;
    IF v_status NOT IN ('downed', 'stable') THEN
      RAISE EXCEPTION 'Nur Downed/Stabil können stabilisiert werden' USING ERRCODE = '22023';
    END IF;
    v_status := 'stable';
    v_dying := 0;
  ELSIF v_op = 'mark_dead' THEN
    IF NOT v_confirm THEN
      RAISE EXCEPTION 'confirmDead erforderlich' USING ERRCODE = '22023';
    END IF;
    v_status := 'dead';
    v_dying := 3;
  ELSIF v_op = 'clear_alive' THEN
    v_status := 'alive';
    v_dying := 0;
    v_wounds := 0;
  ELSIF v_op = 'enter_downed' THEN
    v_dying := public.sagadrive_life_start_level(v_diff, COALESCE((v_in->>'explicitDeadly')::boolean, false));
    IF v_diff = 'Hart' THEN
      IF v_wounds < 3 THEN
        v_wounds := v_wounds + 1;
      ELSE
        v_dying := LEAST(3, v_dying + 1);
      END IF;
    END IF;
    IF v_dying >= 3 THEN
      v_status := 'dead';
      v_dying := 3;
    ELSIF v_dying = 0 THEN
      v_status := 'stable';
    ELSE
      v_status := 'downed';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unbekannte Life-Operation' USING ERRCODE = '22023';
  END IF;

  v_life := jsonb_build_object(
    'schemaVersion', 1,
    'status', v_status,
    'dyingLevel', v_dying,
    'wounds', v_wounds,
    'difficulty', v_diff,
    'updatedAt', NOW()
  );
  v_life_conds := public.sagadrive_life_conditions(v_status, v_dying);
  v_shared := jsonb_set(v_shared, ARRAY['lifeByCharacter', v_char], v_life, true);

  -- Mirror into active encounter participant + conditionsByCharacter when possible
  v_encounter := COALESCE(v_shared->'encounter', '{}'::jsonb);
  IF COALESCE(v_encounter->>'status', '') = 'active' THEN
    v_participants := COALESCE(v_encounter->'participants', '[]'::jsonb);
    v_len := jsonb_array_length(v_participants);
    FOR v_i IN 0 .. v_len - 1 LOOP
      v_participant := v_participants->v_i;
      IF (v_participant->>'kind') = 'pc'
         AND (
           (v_participant->>'refId') = v_char
           OR (v_pid IS NOT NULL AND (v_participant->>'id') = v_pid)
         ) THEN
        v_conditions := public.sagadrive_merge_life_into_conditions(
          COALESCE(v_participant->'conditions', '[]'::jsonb),
          v_life_conds
        );
        v_participant := jsonb_set(v_participant, '{conditions}', v_conditions, true);
        v_participants := jsonb_set(v_participants, ARRAY[v_i::text], v_participant, true);
        v_shared := jsonb_set(
          v_shared,
          ARRAY['conditionsByCharacter', v_char],
          v_conditions,
          true
        );
        EXIT;
      END IF;
    END LOOP;
    v_encounter := jsonb_set(v_encounter, '{participants}', v_participants, true);
    v_shared := jsonb_set(v_shared, '{encounter}', v_encounter, true);
  ELSE
    v_shared := jsonb_set(
      v_shared,
      ARRAY['conditionsByCharacter', v_char],
      v_life_conds,
      true
    );
  END IF;

  v_world := jsonb_set(v_world, '{shared}', v_shared, true);
  v_event := jsonb_build_object(
    'op', v_op,
    'characterId', v_char,
    'participantId', v_pid,
    'grade', v_grade,
    'status', v_status,
    'dyingLevel', v_dying,
    'wounds', v_wounds,
    'difficulty', v_diff,
    'note', v_note,
    'authoritative', true
  );
  RETURN jsonb_build_object('worldState', v_world, 'eventPayload', v_event);
END;
$$;

REVOKE ALL ON FUNCTION public.sagadrive_resolve_life_command(JSONB, BOOLEAN, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sagadrive_resolve_life_command(JSONB, BOOLEAN, JSONB) TO authenticated;

COMMENT ON FUNCTION public.sagadrive_resolve_life_command IS
  'Authoritative death lifecycle (#373): death_save / stabilize / mark_dead / clear_alive.';

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
    'condition', 'scene', 'combat', 'gameplay', 'program', 'reveal', 'life'
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

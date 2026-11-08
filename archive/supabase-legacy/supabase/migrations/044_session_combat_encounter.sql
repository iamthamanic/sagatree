-- 044_session_combat_encounter.sql
-- Authoritative combat/encounter V1 (#300): start/end, initiative, turns, HP, conditions.
-- Stores under world_state.shared.encounter; sets combatActive; syncs NPC instance runtime HP.

CREATE OR REPLACE FUNCTION public.sagadrive_strip_forged_encounter_keys(p_payload JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_payload, '{}'::jsonb)
    - 'initiative'
    - 'hpCurrent'
    - 'hpMax'
    - 'round'
    - 'currentTurnIndex'
    - 'authoritative'
    - 'natural'
    - 'actions'
    - 'status'
    - 'schemaVersion';
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_fresh_action_economy()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'main', 1,
    'move', 1,
    'free', 1,
    'reaction', 1
  );
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_pc_health(p_endurance INT, p_level INT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(
    1,
    12 + 2 * LEAST(5, GREATEST(0, COALESCE(p_endurance, 1)))
      + 2 * public.sagadrive_experience_bonus(COALESCE(p_level, 1))
  );
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_pc_initiative_bonus(
  p_perception INT,
  p_awareness_rank INT,
  p_level INT
)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LEAST(5, GREATEST(0, COALESCE(p_perception, 1)))
       + LEAST(5, GREATEST(0, COALESCE(p_awareness_rank, 0)))
       + public.sagadrive_applied_experience_bonus(
           LEAST(5, GREATEST(0, COALESCE(p_awareness_rank, 0))),
           COALESCE(p_level, 1)
         );
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_build_encounter_participant_pc(
  p_character public.characters
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_perception INT;
  v_awareness INT;
  v_bonus INT;
  v_natural INT;
  v_hp_max INT;
  v_name TEXT;
BEGIN
  v_perception := COALESCE((p_character.attributes ->> 'perception')::int, 1);
  v_awareness := COALESCE((p_character.skills ->> 'awareness')::int, 0);
  v_bonus := public.sagadrive_pc_initiative_bonus(
    v_perception, v_awareness, COALESCE(p_character.level, 1)
  );
  v_natural := public.sagadrive_roll_d20();
  v_hp_max := public.sagadrive_pc_health(
    COALESCE((p_character.attributes ->> 'endurance')::int, 1),
    COALESCE(p_character.level, 1)
  );
  v_name := NULLIF(BTRIM(COALESCE(p_character.name, '')), '');
  IF v_name IS NULL THEN v_name := 'Held'; END IF;
  v_name := left(v_name, 120);

  RETURN jsonb_build_object(
    'id', 'pc:' || p_character.id::text,
    'kind', 'pc',
    'refId', p_character.id::text,
    'name', v_name,
    'initiative', v_natural + v_bonus,
    'initiativeBonus', v_bonus,
    'natural', v_natural,
    'hpCurrent', v_hp_max,
    'hpMax', v_hp_max,
    'conditions', '[]'::jsonb,
    'actions', public.sagadrive_fresh_action_economy()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_build_encounter_participant_npc(
  p_instance public.npc_creature_instances
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_bonus INT := 0;
  v_natural INT;
  v_hp_max INT;
  v_hp_cur INT;
  v_name TEXT;
  v_conditions JSONB;
BEGIN
  v_hp_max := COALESCE((p_instance.snapshot ->> 'maxHealth')::int, 10);
  IF v_hp_max < 1 THEN v_hp_max := 10; END IF;
  IF v_hp_max > 9999 THEN v_hp_max := 9999; END IF;

  v_hp_cur := COALESCE((p_instance.runtime ->> 'currentHp')::int, v_hp_max);
  IF v_hp_cur < 0 THEN v_hp_cur := 0; END IF;
  IF v_hp_cur > v_hp_max THEN v_hp_cur := v_hp_max; END IF;

  v_name := NULLIF(BTRIM(COALESCE(p_instance.display_name, '')), '');
  IF v_name IS NULL THEN
    v_name := NULLIF(BTRIM(COALESCE(p_instance.snapshot ->> 'name', '')), '');
  END IF;
  IF v_name IS NULL THEN v_name := 'Gegner'; END IF;
  v_name := left(v_name, 120);

  IF jsonb_typeof(p_instance.runtime -> 'conditions') = 'array' THEN
    v_conditions := p_instance.runtime -> 'conditions';
  ELSE
    v_conditions := '[]'::jsonb;
  END IF;

  -- Optional snapshot initiative hint; never trust client.
  IF (p_instance.snapshot ->> 'initiativeBonus') ~ '^[0-9]+$' THEN
    v_bonus := LEAST(40, (p_instance.snapshot ->> 'initiativeBonus')::int);
  END IF;

  v_natural := public.sagadrive_roll_d20();

  RETURN jsonb_build_object(
    'id', 'npc:' || p_instance.id::text,
    'kind', 'npc',
    'refId', p_instance.id::text,
    'name', v_name,
    'initiative', v_natural + v_bonus,
    'initiativeBonus', v_bonus,
    'natural', v_natural,
    'hpCurrent', v_hp_cur,
    'hpMax', v_hp_max,
    'conditions', v_conditions,
    'actions', public.sagadrive_fresh_action_economy()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_sort_encounter_participants(p_list JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_sorted JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(elem ORDER BY
    (elem->>'initiative')::int DESC,
    (elem->>'initiativeBonus')::int DESC,
    CASE WHEN elem->>'kind' = 'pc' THEN 0 ELSE 1 END,
    elem->>'name'
  ), '[]'::jsonb)
  INTO v_sorted
  FROM jsonb_array_elements(COALESCE(p_list, '[]'::jsonb)) AS elem;
  RETURN v_sorted;
END;
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_sync_npc_instance_from_participant(
  p_participant JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_runtime JSONB;
BEGIN
  IF COALESCE(p_participant->>'kind', '') IS DISTINCT FROM 'npc' THEN
    RETURN;
  END IF;
  BEGIN
    v_id := (p_participant->>'refId')::uuid;
  EXCEPTION WHEN others THEN
    RETURN;
  END;

  SELECT runtime INTO v_runtime FROM public.npc_creature_instances WHERE id = v_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_runtime := COALESCE(v_runtime, '{}'::jsonb);
  v_runtime := jsonb_set(v_runtime, '{currentHp}', to_jsonb(COALESCE((p_participant->>'hpCurrent')::int, 0)), true);
  IF p_participant ? 'conditions' AND jsonb_typeof(p_participant->'conditions') = 'array' THEN
    v_runtime := jsonb_set(v_runtime, '{conditions}', p_participant->'conditions', true);
  END IF;

  UPDATE public.npc_creature_instances
     SET runtime = v_runtime, updated_at = NOW()
   WHERE id = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_resolve_combat_command(
  p_session_id UUID,
  p_actor UUID,
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
  v_action TEXT := NULLIF(BTRIM(COALESCE(v_in->>'action', '')), '');
  v_world JSONB := COALESCE(p_world, '{}'::jsonb);
  v_shared JSONB := COALESCE(v_world->'shared', '{}'::jsonb);
  v_encounter JSONB;
  v_participants JSONB := '[]'::jsonb;
  v_seed JSONB;
  v_kind TEXT;
  v_ref TEXT;
  v_char public.characters;
  v_npc public.npc_creature_instances;
  v_built JSONB;
  v_session public.sessions;
  v_i INT;
  v_len INT;
  v_participant JSONB;
  v_slot TEXT;
  v_pid TEXT;
  v_actions JSONB;
  v_count INT;
  v_event JSONB;
BEGIN
  IF jsonb_typeof(v_shared) IS DISTINCT FROM 'object' THEN
    v_shared := '{}'::jsonb;
  END IF;
  v_encounter := COALESCE(v_shared->'encounter', '{}'::jsonb);

  IF v_action = 'start' THEN
    IF NOT p_is_gm THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF COALESCE(v_encounter->>'status', '') = 'active' THEN
      RAISE EXCEPTION 'Encounter bereits aktiv' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(v_in->'participants') IS DISTINCT FROM 'array'
       OR jsonb_array_length(v_in->'participants') < 1 THEN
      RAISE EXCEPTION 'Encounter-Start benötigt Teilnehmer' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;

    FOR v_i IN 0 .. LEAST(jsonb_array_length(v_in->'participants'), 24) - 1 LOOP
      v_seed := v_in->'participants'->v_i;
      v_kind := NULLIF(BTRIM(COALESCE(v_seed->>'kind', '')), '');
      v_ref := NULLIF(BTRIM(COALESCE(
        v_seed->>'refId',
        COALESCE(v_seed->>'characterId', v_seed->>'instanceId')
      )), '');
      IF v_kind IS NULL OR v_ref IS NULL THEN
        CONTINUE;
      END IF;

      IF v_kind = 'pc' THEN
        BEGIN
          SELECT * INTO v_char FROM public.characters WHERE id = v_ref::uuid;
        EXCEPTION WHEN others THEN
          RAISE EXCEPTION 'Ungültige Charakter-ID' USING ERRCODE = '22023';
        END;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Charakter nicht gefunden' USING ERRCODE = 'P0002';
        END IF;
        v_built := public.sagadrive_build_encounter_participant_pc(v_char);
        IF NULLIF(BTRIM(COALESCE(v_seed->>'name', '')), '') IS NOT NULL THEN
          v_built := jsonb_set(v_built, '{name}', to_jsonb(left(BTRIM(v_seed->>'name'), 120)), true);
        END IF;
        v_participants := v_participants || jsonb_build_array(v_built);
      ELSIF v_kind = 'npc' THEN
        BEGIN
          SELECT * INTO v_npc FROM public.npc_creature_instances WHERE id = v_ref::uuid;
        EXCEPTION WHEN others THEN
          RAISE EXCEPTION 'Ungültige Instanz-ID' USING ERRCODE = '22023';
        END;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'NPC-Instanz nicht gefunden' USING ERRCODE = 'P0002';
        END IF;
        IF v_npc.project_id IS DISTINCT FROM v_session.project_id THEN
          RAISE EXCEPTION 'NPC-Instanz gehört nicht zu diesem Abenteuer' USING ERRCODE = '42501';
        END IF;
        v_built := public.sagadrive_build_encounter_participant_npc(v_npc);
        IF NULLIF(BTRIM(COALESCE(v_seed->>'name', '')), '') IS NOT NULL THEN
          v_built := jsonb_set(v_built, '{name}', to_jsonb(left(BTRIM(v_seed->>'name'), 120)), true);
        END IF;
        v_participants := v_participants || jsonb_build_array(v_built);
      END IF;
    END LOOP;

    IF jsonb_array_length(v_participants) < 1 THEN
      RAISE EXCEPTION 'Keine gültigen Teilnehmer' USING ERRCODE = '22023';
    END IF;

    v_participants := public.sagadrive_sort_encounter_participants(v_participants);
    v_encounter := jsonb_build_object(
      'schemaVersion', 1,
      'status', 'active',
      'round', 1,
      'currentTurnIndex', 0,
      'participants', v_participants,
      'authoritative', true
    );
    v_shared := jsonb_set(v_shared, '{encounter}', v_encounter, true);
    v_world := jsonb_set(v_world, '{shared}', v_shared, true);
    v_world := jsonb_set(v_world, '{combatActive}', 'true'::jsonb, true);
    v_event := jsonb_build_object(
      'action', 'start',
      'round', 1,
      'participantCount', jsonb_array_length(v_participants),
      'authoritative', true
    );
    RETURN jsonb_build_object('worldState', v_world, 'eventPayload', v_event);
  END IF;

  IF v_action = 'end' THEN
    IF NOT p_is_gm THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF COALESCE(v_encounter->>'status', '') IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Kein aktiver Encounter' USING ERRCODE = '22023';
    END IF;
    v_encounter := jsonb_set(v_encounter, '{status}', '"ended"'::jsonb, true);
    v_shared := jsonb_set(v_shared, '{encounter}', v_encounter, true);
    v_world := jsonb_set(v_world, '{shared}', v_shared, true);
    v_world := jsonb_set(v_world, '{combatActive}', 'false'::jsonb, true);
    v_event := jsonb_build_object('action', 'end', 'authoritative', true);
    RETURN jsonb_build_object('worldState', v_world, 'eventPayload', v_event);
  END IF;

  IF v_action = 'nextTurn' THEN
    IF NOT p_is_gm THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF COALESCE(v_encounter->>'status', '') IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Kein aktiver Encounter' USING ERRCODE = '22023';
    END IF;
    v_participants := COALESCE(v_encounter->'participants', '[]'::jsonb);
    v_len := jsonb_array_length(v_participants);
    IF v_len < 1 THEN
      RAISE EXCEPTION 'Encounter ohne Teilnehmer' USING ERRCODE = '22023';
    END IF;
    v_i := COALESCE((v_encounter->>'currentTurnIndex')::int, 0);
    v_i := (v_i + 1) % v_len;
    IF v_i = 0 THEN
      v_encounter := jsonb_set(
        v_encounter,
        '{round}',
        to_jsonb(COALESCE((v_encounter->>'round')::int, 1) + 1),
        true
      );
    END IF;
    v_encounter := jsonb_set(v_encounter, '{currentTurnIndex}', to_jsonb(v_i), true);
    -- Refresh action economy for the actor whose turn begins
    v_participant := v_participants->v_i;
    v_participant := jsonb_set(v_participant, '{actions}', public.sagadrive_fresh_action_economy(), true);
    v_participants := jsonb_set(v_participants, ARRAY[v_i::text], v_participant, true);
    v_encounter := jsonb_set(v_encounter, '{participants}', v_participants, true);
    v_shared := jsonb_set(v_shared, '{encounter}', v_encounter, true);
    v_world := jsonb_set(v_world, '{shared}', v_shared, true);
    v_event := jsonb_build_object(
      'action', 'nextTurn',
      'round', (v_encounter->>'round')::int,
      'currentTurnIndex', v_i,
      'currentParticipantId', v_participant->>'id',
      'authoritative', true
    );
    RETURN jsonb_build_object('worldState', v_world, 'eventPayload', v_event);
  END IF;

  IF v_action = 'spendAction' THEN
    IF COALESCE(v_encounter->>'status', '') IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Kein aktiver Encounter' USING ERRCODE = '22023';
    END IF;
    v_pid := NULLIF(BTRIM(COALESCE(v_in->>'participantId', '')), '');
    v_slot := NULLIF(BTRIM(COALESCE(v_in->>'slot', '')), '');
    IF v_pid IS NULL OR v_slot IS NULL OR v_slot NOT IN ('main', 'move', 'free', 'reaction') THEN
      RAISE EXCEPTION 'spendAction benötigt participantId und Slot' USING ERRCODE = '22023';
    END IF;
    v_participants := COALESCE(v_encounter->'participants', '[]'::jsonb);
    v_len := jsonb_array_length(v_participants);
    v_i := COALESCE((v_encounter->>'currentTurnIndex')::int, 0);
    v_participant := NULL;
    FOR v_count IN 0 .. v_len - 1 LOOP
      IF (v_participants->v_count->>'id') = v_pid THEN
        v_participant := v_participants->v_count;
        v_i := v_count;
        EXIT;
      END IF;
    END LOOP;
    IF v_participant IS NULL THEN
      RAISE EXCEPTION 'Teilnehmer nicht gefunden' USING ERRCODE = 'P0002';
    END IF;
    -- Only current turn actor (PC owner) or GM may spend
    IF NOT p_is_gm THEN
      IF COALESCE((v_encounter->>'currentTurnIndex')::int, 0) IS DISTINCT FROM v_i THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
      END IF;
      IF v_participant->>'kind' = 'pc' THEN
        SELECT * INTO v_char FROM public.characters WHERE id = (v_participant->>'refId')::uuid;
        IF NOT FOUND OR v_char.owner_user_id IS DISTINCT FROM p_actor THEN
          RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
        END IF;
      ELSE
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
      END IF;
    END IF;
    v_actions := COALESCE(v_participant->'actions', public.sagadrive_fresh_action_economy());
    v_count := COALESCE((v_actions->>v_slot)::int, 0);
    IF v_count < 1 THEN
      RAISE EXCEPTION 'Keine Aktion mehr verfügbar' USING ERRCODE = '22023';
    END IF;
    v_actions := jsonb_set(v_actions, ARRAY[v_slot], to_jsonb(v_count - 1), true);
    v_participant := jsonb_set(v_participant, '{actions}', v_actions, true);
    v_participants := jsonb_set(v_participants, ARRAY[v_i::text], v_participant, true);
    v_encounter := jsonb_set(v_encounter, '{participants}', v_participants, true);
    v_shared := jsonb_set(v_shared, '{encounter}', v_encounter, true);
    v_world := jsonb_set(v_world, '{shared}', v_shared, true);
    v_event := jsonb_build_object(
      'action', 'spendAction',
      'participantId', v_pid,
      'slot', v_slot,
      'authoritative', true
    );
    RETURN jsonb_build_object('worldState', v_world, 'eventPayload', v_event);
  END IF;

  RAISE EXCEPTION 'Unbekannte Combat-Aktion' USING ERRCODE = '22023';
END;
$$;

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
  IF v_mode = 'damage' AND v_prev > 0 AND v_hp = 0 THEN
    IF NOT (v_conditions @> '"bewusstlos"'::jsonb) THEN
      v_conditions := v_conditions || '"bewusstlos"'::jsonb;
    END IF;
  ELSIF v_mode = 'heal' AND v_prev = 0 AND v_hp > 0 THEN
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      INTO v_conditions
      FROM jsonb_array_elements_text(v_conditions) AS elem
     WHERE elem NOT IN ('bewusstlos', 'unconscious');
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
  -- Mirror own PC overlay for player panel when damaged character is PC
  IF v_participant->>'kind' = 'pc' THEN
    v_shared := jsonb_set(
      v_shared,
      ARRAY['hpByCharacter', v_participant->>'refId'],
      to_jsonb(v_hp),
      true
    );
    v_shared := jsonb_set(
      v_shared,
      ARRAY['conditionsByCharacter', v_participant->>'refId'],
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
    'authoritative', true
  );
  RETURN jsonb_build_object('worldState', v_world, 'eventPayload', v_event);
END;
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_resolve_condition_command(
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
  v_op TEXT;
  v_condition TEXT;
  v_i INT;
  v_len INT;
  v_participant JSONB;
  v_conditions JSONB;
  v_event JSONB;
  v_has BOOLEAN;
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
  v_op := COALESCE(NULLIF(BTRIM(COALESCE(v_in->>'op', '')), ''), 'add');
  v_condition := left(NULLIF(BTRIM(COALESCE(v_in->>'condition', '')), ''), 80);
  IF v_pid IS NULL OR v_condition IS NULL OR v_op NOT IN ('add', 'remove') THEN
    RAISE EXCEPTION 'Zustand benötigt participantId, op und condition' USING ERRCODE = '22023';
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

  v_conditions := COALESCE(v_participant->'conditions', '[]'::jsonb);
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_conditions) AS c WHERE c = v_condition
  ) INTO v_has;

  IF v_op = 'add' AND NOT v_has AND jsonb_array_length(v_conditions) < 24 THEN
    v_conditions := v_conditions || to_jsonb(v_condition);
  ELSIF v_op = 'remove' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
      INTO v_conditions
      FROM jsonb_array_elements_text(COALESCE(v_participant->'conditions', '[]'::jsonb)) AS c
     WHERE c <> v_condition;
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
  IF v_participant->>'kind' = 'pc' THEN
    v_shared := jsonb_set(
      v_shared,
      ARRAY['conditionsByCharacter', v_participant->>'refId'],
      v_conditions,
      true
    );
  END IF;
  v_world := jsonb_set(v_world, '{shared}', v_shared, true);
  PERFORM public.sagadrive_sync_npc_instance_from_participant(v_participant);

  v_event := jsonb_build_object(
    'op', v_op,
    'participantId', v_pid,
    'condition', v_condition,
    'authoritative', true
  );
  RETURN jsonb_build_object('worldState', v_world, 'eventPayload', v_event);
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
  ELSIF p_kind = 'gameplay' THEN
    IF NOT v_is_gm THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF p_payload ? 'sceneId' THEN
      v_world := jsonb_set(v_world, '{sceneId}', to_jsonb(p_payload->>'sceneId'), true);
    END IF;
    -- Never replace entire shared blob from client — only allow checkTarget publish
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

REVOKE ALL ON FUNCTION public.sagadrive_resolve_combat_command(UUID, UUID, JSONB, BOOLEAN, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sagadrive_resolve_damage_command(JSONB, BOOLEAN, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sagadrive_resolve_condition_command(JSONB, BOOLEAN, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sagadrive_sync_npc_instance_from_participant(JSONB) FROM PUBLIC;

COMMENT ON FUNCTION public.sagadrive_resolve_combat_command IS
  'Authoritative encounter start/end/turn/spendAction (#300); strips forged initiative/HP.';
COMMENT ON FUNCTION public.sagadrive_resolve_damage_command IS
  'GM damage/heal on encounter participants (#300); syncs NPC instance runtime.';
COMMENT ON FUNCTION public.sagadrive_resolve_condition_command IS
  'GM add/remove conditions on encounter participants (#300).';

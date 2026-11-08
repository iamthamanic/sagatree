-- 042_session_shared_rolls.sql
-- Authoritative shared checks (#299): server dice + grade; strip client-forged results.

CREATE OR REPLACE FUNCTION public.sagadrive_skill_attribute_key(p_skill TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_skill
    WHEN 'athletics' THEN 'strength'
    WHEN 'acrobatics' THEN 'dexterity'
    WHEN 'sleight' THEN 'dexterity'
    WHEN 'stealth' THEN 'dexterity'
    WHEN 'melee' THEN 'strength'
    WHEN 'ranged' THEN 'dexterity'
    WHEN 'awareness' THEN 'perception'
    WHEN 'insight' THEN 'perception'
    WHEN 'survival' THEN 'perception'
    WHEN 'investigation' THEN 'mind'
    WHEN 'knowledge' THEN 'mind'
    WHEN 'technology' THEN 'mind'
    WHEN 'medicine' THEN 'mind'
    WHEN 'driving' THEN 'dexterity'
    WHEN 'persuasion' THEN 'charisma'
    WHEN 'deception' THEN 'charisma'
    WHEN 'intimidation' THEN 'charisma'
    WHEN 'performance' THEN 'charisma'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_experience_bonus(p_level INT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_level IS NULL OR p_level < 1 THEN 1
    WHEN p_level <= 4 THEN 1
    WHEN p_level <= 8 THEN 2
    WHEN p_level <= 12 THEN 3
    WHEN p_level <= 16 THEN 4
    ELSE 5
  END;
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_applied_experience_bonus(p_skill_rank INT, p_level INT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_skill_rank, 0) <= 0 THEN 0
    ELSE LEAST(public.sagadrive_experience_bonus(p_level), COALESCE(p_skill_rank, 0) + 1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_roll_d20()
RETURNS INT
LANGUAGE sql
VOLATILE
AS $$
  SELECT (1 + floor(random() * 20))::int;
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_resolve_probe_grade(
  p_total INT,
  p_target INT,
  p_natural INT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_margin INT := p_total - p_target;
  v_grade TEXT;
BEGIN
  IF v_margin >= 10 THEN
    v_grade := 'crit-success';
  ELSIF v_margin >= 0 THEN
    v_grade := 'success';
  ELSIF v_margin <= -10 THEN
    v_grade := 'crit-failure';
  ELSE
    v_grade := 'failure';
  END IF;

  IF p_natural = 20 AND v_grade IS DISTINCT FROM 'crit-success' THEN
    IF v_grade = 'crit-failure' THEN v_grade := 'failure';
    ELSIF v_grade = 'failure' THEN v_grade := 'success';
    ELSE v_grade := 'crit-success';
    END IF;
  ELSIF p_natural = 1 AND v_grade IS DISTINCT FROM 'crit-failure' THEN
    IF v_grade = 'crit-success' THEN v_grade := 'success';
    ELSIF v_grade = 'success' THEN v_grade := 'failure';
    ELSE v_grade := 'crit-failure';
    END IF;
  END IF;

  RETURN v_grade;
END;
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_grade_rank(p_grade TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_grade
    WHEN 'crit-failure' THEN 0
    WHEN 'failure' THEN 1
    WHEN 'success' THEN 2
    WHEN 'crit-success' THEN 3
    ELSE -1
  END;
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_strip_forged_roll_keys(p_payload JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_payload, '{}'::jsonb)
    - 'total'
    - 'grade'
    - 'natural'
    - 'naturals'
    - 'dice'
    - 'result'
    - 'outcome'
    - 'keptNatural'
    - 'flatBonus'
    - 'attributeValue'
    - 'skillRank'
    - 'experienceBonus'
    - 'driveSpent'
    - 'driveRemaining'
    - 'authoritative';
$$;

CREATE OR REPLACE FUNCTION public.sagadrive_resolve_session_check(
  p_session_id UUID,
  p_actor UUID,
  p_payload JSONB,
  p_is_gm BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_in JSONB := public.sagadrive_strip_forged_roll_keys(p_payload);
  v_skill TEXT := NULLIF(BTRIM(COALESCE(v_in->>'skill', '')), '');
  v_mode TEXT := COALESCE(NULLIF(BTRIM(COALESCE(v_in->>'mode', '')), ''), 'normal');
  v_use_drive BOOLEAN := COALESCE((v_in->>'useDrive')::boolean, false);
  v_attr_key TEXT;
  v_character public.characters;
  v_char_id UUID;
  v_public_id TEXT;
  v_attr INT;
  v_skill_rank INT;
  v_eb INT;
  v_flat INT;
  v_world JSONB;
  v_shared JSONB;
  v_target INT;
  v_drive INT;
  v_n1 INT;
  v_n2 INT;
  v_natural INT;
  v_total INT;
  v_grade TEXT;
  v_n1b INT;
  v_n2b INT;
  v_natural_b INT;
  v_total_b INT;
  v_grade_b_text TEXT;
  v_drive_spent INT := 0;
  v_naturals JSONB;
  v_result JSONB;
BEGIN
  IF v_skill IS NULL OR public.sagadrive_skill_attribute_key(v_skill) IS NULL THEN
    RAISE EXCEPTION 'Invalid skill for session check' USING ERRCODE = '22023';
  END IF;
  IF v_mode NOT IN ('normal', 'advantage', 'disadvantage') THEN
    RAISE EXCEPTION 'Invalid check mode' USING ERRCODE = '22023';
  END IF;

  v_attr_key := public.sagadrive_skill_attribute_key(v_skill);
  v_public_id := NULLIF(BTRIM(COALESCE(v_in->>'characterPublicId', '')), '');

  IF v_in ? 'characterId' AND NULLIF(BTRIM(COALESCE(v_in->>'characterId', '')), '') IS NOT NULL THEN
    BEGIN
      v_char_id := (v_in->>'characterId')::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Invalid characterId' USING ERRCODE = '22023';
    END;
    SELECT * INTO v_character FROM public.characters WHERE id = v_char_id;
  ELSIF v_public_id IS NOT NULL THEN
    SELECT * INTO v_character FROM public.characters WHERE public_id = v_public_id;
  ELSE
    RAISE EXCEPTION 'characterPublicId or characterId required' USING ERRCODE = '22023';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character not found for session check' USING ERRCODE = 'P0002';
  END IF;

  -- Membership already checked by caller; character must belong to actor or actor is GM.
  IF NOT p_is_gm AND v_character.user_id IS DISTINCT FROM p_actor THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_attr := COALESCE((v_character.attributes ->> v_attr_key)::int, 0);
  IF v_attr < 1 OR v_attr > 5 THEN
    RAISE EXCEPTION 'Character attribute out of range for check' USING ERRCODE = '22023';
  END IF;

  v_skill_rank := COALESCE((v_character.skills ->> v_skill)::int, 0);
  IF v_skill_rank < 0 OR v_skill_rank > 5 THEN
    RAISE EXCEPTION 'Character skill rank out of range' USING ERRCODE = '22023';
  END IF;

  v_eb := public.sagadrive_applied_experience_bonus(v_skill_rank, COALESCE(v_character.level, 1));
  v_flat := v_attr + v_skill_rank + v_eb;

  SELECT world_state INTO v_world FROM public.sessions WHERE id = p_session_id;
  v_world := COALESCE(v_world, '{}'::jsonb);
  v_shared := COALESCE(v_world->'shared', '{}'::jsonb);
  IF jsonb_typeof(v_shared) IS DISTINCT FROM 'object' THEN
    v_shared := '{}'::jsonb;
  END IF;

  -- Target: GM may set via payload; else shared.checkTarget / resistance; default 15.
  IF p_is_gm AND v_in ? 'target' AND (v_in->>'target') ~ '^-?[0-9]+$' THEN
    v_target := (v_in->>'target')::int;
    v_shared := jsonb_set(v_shared, '{checkTarget}', to_jsonb(v_target), true);
  ELSIF p_is_gm AND v_in ? 'resistance' AND (v_in->>'resistance') ~ '^-?[0-9]+$' THEN
    v_target := (v_in->>'resistance')::int;
    v_shared := jsonb_set(v_shared, '{checkTarget}', to_jsonb(v_target), true);
  ELSIF v_shared ? 'checkTarget' AND (v_shared->>'checkTarget') ~ '^-?[0-9]+$' THEN
    v_target := (v_shared->>'checkTarget')::int;
  ELSE
    v_target := 15;
  END IF;

  -- Drive pool: prefer shared overlay keyed by character id, else profile.
  IF v_shared ? 'driveByCharacter'
     AND jsonb_typeof(v_shared->'driveByCharacter') = 'object'
     AND (v_shared->'driveByCharacter') ? v_character.id::text
     AND ((v_shared->'driveByCharacter'->>v_character.id::text) ~ '^[0-9]+$') THEN
    v_drive := (v_shared->'driveByCharacter'->>v_character.id::text)::int;
  ELSE
    v_drive := COALESCE((v_character.sagadrive_profile->>'drive')::int, 3);
  END IF;
  IF v_drive < 0 THEN v_drive := 0; END IF;
  IF v_drive > 5 THEN v_drive := 5; END IF;

  v_n1 := public.sagadrive_roll_d20();
  IF v_mode = 'normal' THEN
    v_natural := v_n1;
    v_naturals := jsonb_build_array(v_n1);
  ELSE
    v_n2 := public.sagadrive_roll_d20();
    IF v_mode = 'advantage' THEN
      v_natural := GREATEST(v_n1, v_n2);
    ELSE
      v_natural := LEAST(v_n1, v_n2);
    END IF;
    v_naturals := jsonb_build_array(v_n1, v_n2);
  END IF;

  v_total := v_natural + v_flat;
  v_grade := public.sagadrive_resolve_probe_grade(v_total, v_target, v_natural);

  IF v_use_drive THEN
    IF v_drive < 1 THEN
      RAISE EXCEPTION 'No Drive available for reroll' USING ERRCODE = '22023';
    END IF;
    v_n1b := public.sagadrive_roll_d20();
    IF v_mode = 'normal' THEN
      v_natural_b := v_n1b;
    ELSE
      v_n2b := public.sagadrive_roll_d20();
      IF v_mode = 'advantage' THEN
        v_natural_b := GREATEST(v_n1b, v_n2b);
      ELSE
        v_natural_b := LEAST(v_n1b, v_n2b);
      END IF;
    END IF;
    v_total_b := v_natural_b + v_flat;
    v_grade_b_text := public.sagadrive_resolve_probe_grade(v_total_b, v_target, v_natural_b);
    -- Keep better (§2.10): higher grade rank, then higher total.
    IF public.sagadrive_grade_rank(v_grade_b_text) > public.sagadrive_grade_rank(v_grade)
       OR (
         public.sagadrive_grade_rank(v_grade_b_text) = public.sagadrive_grade_rank(v_grade)
         AND v_total_b > v_total
       ) THEN
      v_natural := v_natural_b;
      v_total := v_total_b;
      v_grade := v_grade_b_text;
      IF v_mode = 'normal' THEN
        v_naturals := jsonb_build_array(v_n1b);
      ELSE
        v_naturals := jsonb_build_array(v_n1b, v_n2b);
      END IF;
    END IF;
    v_drive_spent := 1;
    v_drive := v_drive - 1;
  END IF;

  v_shared := jsonb_set(
    COALESCE(v_shared, '{}'::jsonb),
    ARRAY['driveByCharacter', v_character.id::text],
    to_jsonb(v_drive),
    true
  );

  v_result := jsonb_build_object(
    'intent', 'standard-check',
    'skill', v_skill,
    'mode', v_mode,
    'useDrive', v_use_drive,
    'characterPublicId', COALESCE(v_character.public_id, v_public_id),
    'characterId', v_character.id,
    'target', v_target,
    'natural', v_natural,
    'naturals', v_naturals,
    'flatBonus', v_flat,
    'attributeValue', v_attr,
    'skillRank', v_skill_rank,
    'experienceBonus', v_eb,
    'total', v_total,
    'grade', v_grade,
    'driveSpent', v_drive_spent,
    'driveRemaining', v_drive,
    'actorUserId', p_actor,
    'authoritative', true
  );

  v_shared := jsonb_set(v_shared, '{lastRoll}', v_result, true);
  v_world := jsonb_set(COALESCE(v_world, '{}'::jsonb), '{shared}', v_shared, true);

  RETURN jsonb_build_object(
    'eventPayload', v_result,
    'worldState', v_world
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sagadrive_resolve_session_check(UUID, UUID, JSONB, BOOLEAN) FROM PUBLIC;

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
  ELSIF p_kind IN ('scene', 'combat', 'gameplay', 'condition', 'damage') THEN
    IF NOT v_is_gm AND p_kind IN ('scene', 'combat', 'gameplay') THEN
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
    -- GM may publish checkTarget without a roll.
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

COMMENT ON FUNCTION public.sagadrive_resolve_session_check IS
  'Authoritative session check (#299): server RNG + rules kernel grade; strips client-forged results.';

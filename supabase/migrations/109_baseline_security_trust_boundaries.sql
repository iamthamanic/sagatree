-- 109: Harden legacy Postgres trust boundaries flagged by baseline probes.
-- Fixes: cross-saga atlas leak, legacy map redaction bypass, foreign leave
-- mutation, forgeable SECURITY DEFINER helpers, recap overload ambiguity,
-- dice ownership column (characters.owner_user_id).

-- ---------------------------------------------------------------------------
-- append_session_event: not callable by client roles; require real actor match
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.append_session_event(
  p_session_id UUID,
  p_kind TEXT,
  p_actor UUID,
  p_payload JSONB,
  p_revision_after BIGINT,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_caller UUID := auth.uid();
BEGIN
  -- Client roles must not forge events as another actor. SECURITY DEFINER
  -- callers running as owner (not anon/authenticated) may pass through.
  IF current_user IN ('anon', 'authenticated') THEN
    IF v_caller IS NULL OR v_caller IS DISTINCT FROM p_actor THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF NOT public.is_session_participant(p_session_id, v_caller) THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.session_events (
    session_id, kind, actor_user_id, payload, revision_after, idempotency_key
  ) VALUES (
    p_session_id,
    p_kind,
    p_actor,
    COALESCE(p_payload, '{}'::jsonb),
    p_revision_after,
    NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '')
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.append_session_event(UUID, TEXT, UUID, JSONB, BIGINT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_session_event(UUID, TEXT, UUID, JSONB, BIGINT, TEXT) FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- leave_play_session: only mutate revision/events when a roster row is removed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leave_play_session(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor UUID := auth.uid();
  v_session public.sessions;
  v_revision BIGINT;
  v_removed INT := 0;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    DELETE FROM public.session_players WHERE session_id = p_session_id AND user_id = actor;
    RETURN;
  END IF;

  DELETE FROM public.session_players
   WHERE session_id = p_session_id AND user_id = actor;
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  IF v_removed = 0 THEN
    -- Foreign / non-participant leave is a no-op (no revision bump, no event).
    RETURN;
  END IF;

  v_revision := COALESCE(v_session.runtime_revision, 0) + 1;
  UPDATE public.sessions
     SET runtime_revision = v_revision, updated_at = NOW()
   WHERE id = p_session_id;
  PERFORM public.append_session_event(
    p_session_id,
    'leave',
    actor,
    '{}'::jsonb,
    v_revision,
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.leave_play_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_play_session(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_world_map: non-editors always receive redacted pins (ignore client flag)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_world_map(
  p_world_profile_id UUID,
  p_player_view BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_row public.world_maps%ROWTYPE;
  v_data JSONB;
  v_pins JSONB;
  v_force_player BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_world_profile_id IS NULL THEN
    RAISE EXCEPTION 'world_profile_id required' USING ERRCODE = '22023';
  END IF;
  IF NOT public.current_user_can_read_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_force_player := (NOT public.current_user_can_edit_world_profile(p_world_profile_id))
                    OR (p_player_view IS TRUE);

  SELECT * INTO v_row FROM public.world_maps WHERE world_profile_id = p_world_profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'worldProfileId', p_world_profile_id,
      'revision', 0,
      'mapData', jsonb_build_object(
        'size', 24,
        'tiles', '{}'::jsonb,
        'countries', '[]'::jsonb,
        'pins', '[]'::jsonb
      ),
      'updatedAt', NULL
    );
  END IF;

  v_data := COALESCE(v_row.map_data, '{}'::jsonb);
  IF v_force_player THEN
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      INTO v_pins
      FROM jsonb_array_elements(COALESCE(v_data->'pins', '[]'::jsonb)) AS elem
     WHERE COALESCE((elem->>'discovered')::boolean, true) IS TRUE;
    v_data := jsonb_set(v_data, '{pins}', COALESCE(v_pins, '[]'::jsonb), true);
  END IF;

  RETURN jsonb_build_object(
    'worldProfileId', v_row.world_profile_id,
    'revision', v_row.revision,
    'mapData', v_data,
    'updatedAt', v_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_world_map(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_world_map(UUID, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- list_world_atlas_maps: require active membership for the requested saga
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_world_atlas_maps(
  p_world_profile_id UUID,
  p_player_view BOOLEAN DEFAULT false,
  p_saga_public_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_rows JSONB;
  v_can_edit BOOLEAN;
  v_party_only BOOLEAN;
  v_project UUID;
  v_allowed UUID[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_world_profile_id IS NULL THEN
    RAISE EXCEPTION 'world_profile_id required' USING ERRCODE = '22023';
  END IF;
  IF NOT public.current_user_can_read_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_can_edit := public.current_user_can_edit_world_profile(p_world_profile_id);
  v_party_only := (NOT v_can_edit) OR (p_player_view IS TRUE);

  IF p_saga_public_id IS NOT NULL AND btrim(p_saga_public_id) <> '' THEN
    v_project := public.atlas_wb_resolve_saga_project(p_world_profile_id, p_saga_public_id);
    IF v_project IS NULL THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF NOT public.current_user_is_active_project_member(v_project) THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_party_only THEN
    IF v_project IS NULL THEN
      RETURN jsonb_build_object('maps', '[]'::jsonb);
    END IF;
    v_allowed := public.atlas_wb_party_revealed_map_ids(p_world_profile_id, v_project);

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'worldProfileId', m.world_profile_id,
        'parentMapId', CASE
          WHEN m.parent_map_id IS NULL THEN NULL
          WHEN m.parent_map_id = ANY (v_allowed) THEN m.parent_map_id
          ELSE NULL
        END,
        'kind', m.kind,
        'title', m.title,
        'sortOrder', m.sort_order,
        'revision', m.revision,
        'updatedAt', m.updated_at,
        'hasAzgaarMap', false,
        'hasBasemap', m.basemap_storage_path IS NOT NULL
      )
      ORDER BY m.sort_order, m.title
    ), '[]'::jsonb)
    INTO v_rows
    FROM public.world_atlas_maps m
    WHERE m.world_profile_id = p_world_profile_id
      AND m.id = ANY (v_allowed);
  ELSE
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'worldProfileId', m.world_profile_id,
        'parentMapId', m.parent_map_id,
        'kind', m.kind,
        'title', m.title,
        'sortOrder', m.sort_order,
        'revision', m.revision,
        'updatedAt', m.updated_at,
        'hasAzgaarMap', m.azgaar_map_storage_path IS NOT NULL,
        'hasBasemap', m.basemap_storage_path IS NOT NULL
      )
      ORDER BY m.sort_order, m.title
    ), '[]'::jsonb)
    INTO v_rows
    FROM public.world_atlas_maps m
    WHERE m.world_profile_id = p_world_profile_id;
  END IF;

  RETURN jsonb_build_object('maps', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.list_world_atlas_maps(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_world_atlas_maps(UUID, BOOLEAN, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Recap: remove ambiguous 2-arg / 3-arg-with-default overload clash
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.save_session_recap_summary(UUID, TEXT);
DROP FUNCTION IF EXISTS public.save_session_recap_summary(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.save_session_recap_summary(
  p_session_id UUID,
  p_summary_text TEXT,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session public.sessions%ROWTYPE;
  v_status TEXT := lower(btrim(COALESCE(p_status, 'draft')));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF v_status NOT IN ('draft', 'approved', 'none') THEN
    RAISE EXCEPTION 'invalid summary status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.is_project_gm(v_session.project_id, v_user) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.session_recaps (session_id, summary_text, summary_status, highlight_lines, snapshot)
  VALUES (
    p_session_id,
    NULLIF(BTRIM(COALESCE(p_summary_text, '')), ''),
    v_status,
    '[]'::jsonb,
    '{}'::jsonb
  )
  ON CONFLICT (session_id) DO UPDATE
    SET summary_text = EXCLUDED.summary_text,
        summary_status = EXCLUDED.summary_status,
        updated_at = NOW();

  RETURN public.get_session_recap(p_session_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_session_recap_summary(
  p_session_id UUID,
  p_summary_text TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.save_session_recap_summary(p_session_id, p_summary_text, 'draft');
END;
$$;

REVOKE ALL ON FUNCTION public.save_session_recap_summary(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_session_recap_summary(UUID, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.save_session_recap_summary(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_session_recap_summary(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Adventure command: derive GM from auth (canonical sagatree_* name)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sagatree_resolve_adventure_command(
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
  -- Ignore client p_is_gm; derive authority from membership.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  SELECT project_id INTO v_project FROM public.sessions WHERE id = p_session_id;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.is_project_gm(v_project, auth.uid()) THEN
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


REVOKE ALL ON FUNCTION public.sagatree_resolve_adventure_command(UUID, JSONB, BOOLEAN, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sagatree_resolve_adventure_command(UUID, JSONB, BOOLEAN, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.sagadrive_resolve_adventure_command(
  p_session_id UUID, p_payload JSONB, p_is_gm BOOLEAN, p_world JSONB
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT public.sagatree_resolve_adventure_command(p_session_id, p_payload, p_is_gm, p_world); $$;
REVOKE ALL ON FUNCTION public.sagadrive_resolve_adventure_command(UUID, JSONB, BOOLEAN, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sagadrive_resolve_adventure_command(UUID, JSONB, BOOLEAN, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- Dice: characters.owner_user_id (canonical sagatree_resolve_session_check)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sagatree_resolve_session_check(
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
  IF NOT p_is_gm AND v_character.owner_user_id IS DISTINCT FROM p_actor THEN
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

REVOKE ALL ON FUNCTION public.sagatree_resolve_session_check(UUID, UUID, JSONB, BOOLEAN) FROM PUBLIC;


CREATE OR REPLACE FUNCTION public.sagadrive_resolve_session_check(
  p_session_id UUID, p_actor UUID, p_payload JSONB, p_is_gm BOOLEAN
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT public.sagatree_resolve_session_check(p_session_id, p_actor, p_payload, p_is_gm); $$;

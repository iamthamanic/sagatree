-- #577 — Adventure simulation live ops (advance_time / apply_simulation_batch / set_party_location).
-- Extends sagadrive_resolve_adventure_command; does not rewrite apply_session_runtime_command.

CREATE OR REPLACE FUNCTION public.sagadrive_ensure_adventure_v2(p_adv JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v JSONB := COALESCE(p_adv, '{}'::jsonb);
BEGIN
  IF jsonb_typeof(v) IS DISTINCT FROM 'object' THEN
    v := public.sagadrive_empty_adventure_runtime();
  END IF;
  IF COALESCE((v->>'schemaVersion')::int, 0) = 2 THEN
    RETURN v
      || jsonb_build_object(
        'time', COALESCE(v->'time', jsonb_build_object('day', 0)),
        'deadlines', COALESCE(v->'deadlines', '[]'::jsonb),
        'threats', COALESCE(v->'threats', '[]'::jsonb),
        'rules', COALESCE(v->'rules', '[]'::jsonb),
        'partyLocationRef', v->'partyLocationRef',
        'rngSeed', COALESCE((v->>'rngSeed')::bigint, 0)
      );
  END IF;
  RETURN v || jsonb_build_object(
    'schemaVersion', 2,
    'time', jsonb_build_object('day', 0),
    'deadlines', '[]'::jsonb,
    'threats', '[]'::jsonb,
    'rules', '[]'::jsonb,
    'partyLocationRef', NULL,
    'rngSeed', 0
  );
END;
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
  v_schema INT;
  v_patch JSONB;
  v_days INT;
  v_loc TEXT;
  v_cons_elem JSONB;
  v_batch_count INT;
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
  v_schema := COALESCE((v_adv->>'schemaVersion')::int, 0);
  IF v_schema NOT IN (1, 2) THEN
    v_adv := public.sagadrive_empty_adventure_runtime() || jsonb_build_object(
      'definitionRef', v_adv->'definitionRef'
    );
    v_schema := 1;
  END IF;

  IF v_op = 'hydrate_from_project' THEN
    IF jsonb_typeof(v_project_adv) = 'object'
       AND COALESCE((v_project_adv->>'schemaVersion')::int, 0) IN (1, 2) THEN
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
    NULL;
  ELSIF v_op IN ('advance_time', 'apply_simulation_batch') THEN
    -- Client preview (pure kernel); server validates + persists patch only.
    v_days := COALESCE((v_in->>'days')::int, 0);
    IF v_op = 'advance_time' AND (v_days < 1 OR v_days > 30) THEN
      RAISE EXCEPTION 'days muss zwischen 1 und 30 liegen' USING ERRCODE = '22023';
    END IF;
    v_patch := v_in->'simulationPatch';
    IF jsonb_typeof(v_patch) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'simulationPatch erforderlich' USING ERRCODE = '22023';
    END IF;
    -- Reject unknown top-level patch keys
    IF EXISTS (
      SELECT 1 FROM jsonb_object_keys(v_patch) k
      WHERE k NOT IN ('time', 'clocks', 'threats', 'deadlines', 'flags', 'rngSeed', 'partyLocationRef', 'rules')
    ) THEN
      RAISE EXCEPTION 'simulationPatch enthält unbekannte Felder' USING ERRCODE = '22023';
    END IF;
    v_adv := public.sagadrive_ensure_adventure_v2(v_adv);
    IF v_patch ? 'time' AND jsonb_typeof(v_patch->'time') = 'object' THEN
      v_adv := jsonb_set(
        v_adv,
        '{time}',
        jsonb_build_object(
          'day', GREATEST(0, LEAST(9999, COALESCE((v_patch->'time'->>'day')::int, 0)))
        ),
        true
      );
    END IF;
    IF v_patch ? 'clocks' AND jsonb_typeof(v_patch->'clocks') = 'object' THEN
      v_adv := jsonb_set(v_adv, '{clocks}', v_patch->'clocks', true);
    END IF;
    IF v_patch ? 'threats' AND jsonb_typeof(v_patch->'threats') = 'array' THEN
      IF jsonb_array_length(v_patch->'threats') > 64 THEN
        RAISE EXCEPTION 'threats zu groß' USING ERRCODE = '22023';
      END IF;
      v_adv := jsonb_set(v_adv, '{threats}', v_patch->'threats', true);
    END IF;
    IF v_patch ? 'deadlines' AND jsonb_typeof(v_patch->'deadlines') = 'array' THEN
      IF jsonb_array_length(v_patch->'deadlines') > 64 THEN
        RAISE EXCEPTION 'deadlines zu groß' USING ERRCODE = '22023';
      END IF;
      v_adv := jsonb_set(v_adv, '{deadlines}', v_patch->'deadlines', true);
    END IF;
    IF v_patch ? 'flags' AND jsonb_typeof(v_patch->'flags') = 'object' THEN
      v_adv := jsonb_set(v_adv, '{flags}', v_patch->'flags', true);
    END IF;
    IF v_patch ? 'rngSeed' THEN
      v_adv := jsonb_set(v_adv, '{rngSeed}', to_jsonb(COALESCE((v_patch->>'rngSeed')::bigint, 0)), true);
    END IF;
    IF v_patch ? 'partyLocationRef' THEN
      v_adv := jsonb_set(
        v_adv,
        '{partyLocationRef}',
        CASE
          WHEN v_patch->>'partyLocationRef' IS NULL OR BTRIM(v_patch->>'partyLocationRef') = '' THEN 'null'::jsonb
          ELSE to_jsonb(left(v_patch->>'partyLocationRef', 80))
        END,
        true
      );
    END IF;
    -- Append consequences from approved preview (batch size limit)
    IF jsonb_typeof(v_in->'appendConsequences') = 'array' THEN
      v_batch_count := jsonb_array_length(v_in->'appendConsequences');
      IF v_batch_count > 32 THEN
        RAISE EXCEPTION 'appendConsequences zu groß' USING ERRCODE = '22023';
      END IF;
      v_cons := COALESCE(v_adv->'consequences', '[]'::jsonb);
      IF jsonb_typeof(v_cons) IS DISTINCT FROM 'array' THEN
        v_cons := '[]'::jsonb;
      END IF;
      FOR v_cons_elem IN SELECT elem FROM jsonb_array_elements(v_in->'appendConsequences') AS elem
      LOOP
        IF NULLIF(BTRIM(COALESCE(v_cons_elem->>'summary', '')), '') IS NULL THEN
          CONTINUE;
        END IF;
        v_vis := COALESCE(NULLIF(BTRIM(COALESCE(v_cons_elem->>'visibility', '')), ''), 'gm_only');
        IF v_vis NOT IN ('public', 'shared', 'gm_only') THEN
          v_vis := 'gm_only';
        END IF;
        v_id := 'c-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
        v_cons := v_cons || jsonb_build_array(jsonb_build_object(
          'id', v_id,
          'kind', left(COALESCE(NULLIF(BTRIM(COALESCE(v_cons_elem->>'kind', '')), ''), 'sim'), 40),
          'summary', left(v_cons_elem->>'summary', 200),
          'visibility', v_vis,
          'createdAt', NOW()
        ));
      END LOOP;
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
    END IF;
    v_schema := 2;
  ELSIF v_op = 'set_party_location' THEN
    v_loc := NULLIF(BTRIM(COALESCE(v_in->>'locationRef', '')), '');
    IF v_loc IS NULL THEN
      RAISE EXCEPTION 'locationRef erforderlich' USING ERRCODE = '22023';
    END IF;
    v_adv := public.sagadrive_ensure_adventure_v2(v_adv);
    v_adv := jsonb_set(v_adv, '{partyLocationRef}', to_jsonb(left(v_loc, 80)), true);
    v_schema := 2;
  ELSE
    RAISE EXCEPTION 'Unbekannte Adventure-Operation' USING ERRCODE = '22023';
  END IF;

  v_rev := GREATEST(0, COALESCE((v_adv->>'sliceRevision')::int, 0)) + 1;
  IF v_op IN ('advance_time', 'apply_simulation_batch', 'set_party_location') OR v_schema = 2 THEN
    v_adv := jsonb_set(v_adv, '{schemaVersion}', '2'::jsonb, true);
  ELSE
    v_adv := jsonb_set(v_adv, '{schemaVersion}', to_jsonb(COALESCE((v_adv->>'schemaVersion')::int, 1)), true);
  END IF;
  v_adv := jsonb_set(v_adv, '{sliceRevision}', to_jsonb(v_rev), true);
  v_adv := jsonb_set(v_adv, '{updatedAt}', to_jsonb(NOW()), true);

  v_shared := jsonb_set(v_shared, '{adventure}', v_adv, true);
  v_world := jsonb_set(v_world, '{shared}', v_shared, true);

  IF v_op IS DISTINCT FROM 'hydrate_from_project' OR v_in->>'forcePersist' = 'true' THEN
    IF v_op IN (
      'set_flag', 'set_relationship', 'tick_clock', 'add_consequence',
      'set_definition_ref', 'persist_to_project',
      'advance_time', 'apply_simulation_batch', 'set_party_location'
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
    'batchId', v_in->>'batchId',
    'days', v_in->'days',
    'definitionRef', v_adv->>'definitionRef',
    'sliceRevision', v_rev,
    'authoritative', true
  );
  RETURN jsonb_build_object('worldState', v_world, 'eventPayload', v_event);
END;
$$;

REVOKE ALL ON FUNCTION public.sagadrive_resolve_adventure_command(UUID, JSONB, BOOLEAN, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sagadrive_resolve_adventure_command(UUID, JSONB, BOOLEAN, JSONB) TO authenticated;

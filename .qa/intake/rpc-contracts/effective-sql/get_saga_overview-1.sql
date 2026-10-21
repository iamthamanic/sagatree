-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.get_saga_overview(p_public_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_project public.projects%ROWTYPE;
  v_is_gm BOOLEAN := false;
  v_is_member BOOLEAN := false;
  v_role TEXT := 'viewer';
  v_shared JSONB;
  v_projected JSONB;
  v_adv JSONB;
  v_episodes JSONB := '[]'::jsonb;
  v_ensemble JSONB := '[]'::jsonb;
  v_clocks JSONB := '[]'::jsonb;
  v_consequences JSONB := '[]'::jsonb;
  v_open_deadlines JSONB := '[]'::jsonb;
  v_open_sessions INT := 0;
  v_latest_session JSONB := NULL;
  v_primary JSONB;
  v_key TEXT;
  v_entry JSONB;
  v_cons_cap INT := 20;
  v_saga_def_id UUID := NULL;
  v_saga_ver_id UUID := NULL;
  v_version_label TEXT := NULL;
  v_newer BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_project
  FROM public.projects
  WHERE public_id = UPPER(BTRIM(COALESCE(p_public_id, '')));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saga not found' USING ERRCODE = 'P0002';
  END IF;

  v_is_gm := public.is_project_gm(v_project.id, v_user);
  v_is_member := public.current_user_is_active_project_member(v_project.id);

  IF NOT v_is_gm AND NOT v_is_member THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_is_gm THEN
    v_role := 'gamemaster';
  ELSE
    SELECT COALESCE(pm.role, 'player') INTO v_role
    FROM public.project_members pm
    WHERE pm.project_id = v_project.id
      AND pm.user_id = v_user
      AND pm.status = 'active'
    LIMIT 1;
    IF v_role = 'gm' THEN
      v_role := 'gamemaster';
    ELSIF v_role = 'observer' THEN
      v_role := 'viewer';
    ELSIF v_role IS NULL OR v_role = '' THEN
      v_role := 'player';
    END IF;
  END IF;


  v_saga_def_id := v_project.saga_id;
  v_saga_ver_id := v_project.saga_version_id;
  IF v_saga_ver_id IS NOT NULL THEN
    SELECT version_label INTO v_version_label
    FROM public.saga_definition_versions WHERE id = v_saga_ver_id;
    SELECT EXISTS (
      SELECT 1 FROM public.saga_definition_versions nv
      WHERE nv.saga_id = v_saga_def_id
        AND nv.status = 'published'
        AND nv.id IS DISTINCT FROM v_saga_ver_id
        AND COALESCE(nv.published_at, nv.created_at) > COALESCE(
          (SELECT published_at FROM public.saga_definition_versions WHERE id = v_saga_ver_id),
          '-infinity'::timestamptz
        )
    ) INTO v_newer;
  END IF;

  v_shared := jsonb_build_object(
    'adventure',
    COALESCE(v_project.adventure_runtime, '{}'::jsonb)
  );
  v_projected := public.sagatree_project_shared_adventure(v_shared, v_is_gm);
  v_adv := COALESCE(v_projected->'adventure', '{}'::jsonb);

  FOR v_key, v_entry IN SELECT * FROM jsonb_each(COALESCE(v_adv->'clocks', '{}'::jsonb))
  LOOP
    v_clocks := v_clocks || jsonb_build_array(
      jsonb_build_object(
        'id', COALESCE(v_entry->>'id', v_key),
        'label', COALESCE(v_entry->>'label', v_key),
        'value', COALESCE((v_entry->>'value')::INT, 0),
        'max', COALESCE((v_entry->>'max')::INT, 1),
        'visibility', COALESCE(v_entry->>'visibility', 'shared')
      )
    );
  END LOOP;

  SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
    INTO v_consequences
    FROM (
      SELECT elem, ord
      FROM (
        SELECT
          elem,
          ROW_NUMBER() OVER (
            ORDER BY COALESCE(elem->>'createdAt', '') DESC
          ) AS ord
        FROM jsonb_array_elements(COALESCE(v_adv->'consequences', '[]'::jsonb)) AS elem
      ) ranked
      WHERE ord <= v_cons_cap
    ) capped;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', COALESCE(elem->>'id', ''),
        'label', COALESCE(elem->>'label', elem->>'id', 'Frist'),
        'dueDay', COALESCE((elem->>'dueDay')::INT, 0),
        'visibility', COALESCE(elem->>'visibility', 'shared')
      )
      ORDER BY COALESCE((elem->>'dueDay')::INT, 999999) ASC
    ),
    '[]'::jsonb
  )
  INTO v_open_deadlines
  FROM (
    SELECT elem
    FROM jsonb_array_elements(COALESCE(v_adv->'deadlines', '[]'::jsonb)) AS elem
    WHERE COALESCE((elem->>'fired')::boolean, false) IS NOT TRUE
      AND (
        v_is_gm
        OR COALESCE(elem->>'visibility', 'shared') IN ('public', 'shared')
      )
    ORDER BY COALESCE((elem->>'dueDay')::INT, 999999) ASC
    LIMIT 32
  ) open_dl;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'sessionId', s.id,
        'sessionPublicId', s.public_id,
        'sessionNumber', s.session_number,
        'name', s.name,
        'status', s.status,
        'startedAt', s.started_at,
        'endedAt', s.ended_at,
        'recapSnippet', COALESCE(
          CASE
            WHEN v_is_gm OR COALESCE(sr.summary_status, 'none') = 'approved' THEN
              NULLIF(BTRIM(COALESCE(sr.summary_text, '')), '')
            ELSE NULL
          END,
          (
            SELECT elem->>'summary'
            FROM jsonb_array_elements(
              public.sagatree_build_recap_highlight_lines(
                COALESCE(sr.snapshot, '{}'::jsonb),
                v_is_gm
              )
            ) AS elem
            LIMIT 1
          )
        )
      )
      ORDER BY s.session_number ASC
    ),
    '[]'::jsonb
  )
  INTO v_episodes
  FROM public.sessions s
  LEFT JOIN public.session_recaps sr ON sr.session_id = s.id
  WHERE s.project_id = v_project.id;

  SELECT COUNT(*)::INT INTO v_open_sessions
  FROM public.sessions s
  WHERE s.project_id = v_project.id
    AND s.status IN ('scheduled', 'active', 'paused');

  SELECT jsonb_build_object(
    'sessionPublicId', s.public_id,
    'sessionNumber', s.session_number,
    'status', s.status,
    'name', s.name
  )
  INTO v_latest_session
  FROM public.sessions s
  WHERE s.project_id = v_project.id
  ORDER BY s.session_number DESC
  LIMIT 1;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'userId', pm.user_id,
        'role', CASE
          WHEN pm.role = 'gm' THEN 'gamemaster'
          WHEN pm.role = 'observer' THEN 'viewer'
          ELSE pm.role
        END,
        'characterId', pm.character_id,
        'characterName', c.name,
        'isSelf', pm.user_id = v_user
      )
      ORDER BY pm.joined_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_ensemble
  FROM public.project_members pm
  LEFT JOIN public.characters c ON c.id = pm.character_id
  WHERE pm.project_id = v_project.id
    AND pm.status = 'active';

  IF v_role = 'gamemaster' THEN
    IF v_open_sessions > 0 AND v_latest_session IS NOT NULL
       AND (v_latest_session->>'status') IN ('scheduled', 'active', 'paused') THEN
      v_primary := jsonb_build_object(
        'kind', 'continue-session',
        'labelDe', 'Session fortsetzen',
        'sessionPublicId', v_latest_session->>'sessionPublicId'
      );
    ELSE
      v_primary := jsonb_build_object(
        'kind', 'host-session',
        'labelDe', 'Session hosten',
        'sessionPublicId', NULL
      );
    END IF;
  ELSIF v_role = 'viewer' THEN
    IF v_open_sessions > 0 AND v_latest_session IS NOT NULL THEN
      v_primary := jsonb_build_object(
        'kind', 'join-session',
        'labelDe', 'Session beobachten',
        'sessionPublicId', v_latest_session->>'sessionPublicId'
      );
    ELSE
      v_primary := jsonb_build_object(
        'kind', 'wait',
        'labelDe', 'Warten auf Einladung',
        'sessionPublicId', NULL
      );
    END IF;
  ELSE
    IF v_open_sessions > 0 AND v_latest_session IS NOT NULL THEN
      v_primary := jsonb_build_object(
        'kind', 'join-session',
        'labelDe', 'Zur Session',
        'sessionPublicId', v_latest_session->>'sessionPublicId'
      );
    ELSE
      v_primary := jsonb_build_object(
        'kind', 'wait',
        'labelDe', 'Warten auf Einladung',
        'sessionPublicId', NULL
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'projectId', v_project.id,
    'sagaPublicId', v_project.public_id,
    'title', v_project.name,
    'blurb', COALESCE(v_project.description, ''),
    'status', v_project.status,
    'selfRole', v_role,
    'isGm', v_is_gm,
    'definitionRef', v_adv->>'definitionRef',
    'sagaDefinitionId', v_saga_def_id,
    'sagaVersionId', v_saga_ver_id,
    'versionLabel', v_version_label,
    'newerVersionAvailable', v_newer,
    'primaryAction', v_primary,
    'episodes', v_episodes,
    'ensemble', v_ensemble,
    'worldProfileId', v_project.world_profile_id,
    'worldStateSummary', jsonb_build_object(
      'clocks', v_clocks,
      'consequences', v_consequences,
      'openDeadlines', v_open_deadlines,
      'partyLocationRef', NULLIF(BTRIM(COALESCE(v_adv->>'partyLocationRef', '')), ''),
      'flagCount', public.jsonb_object_keys_count(v_adv->'flags'),
      'updatedAt', v_adv->>'updatedAt'
    )
  );
END;
$$;

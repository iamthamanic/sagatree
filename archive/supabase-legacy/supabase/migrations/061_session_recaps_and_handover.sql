-- #572 — Persist session recaps + hydrate next session from project adventure_runtime.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS runtime_revision BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.session_recaps (
  session_id UUID PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  summary_text TEXT,
  highlight_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.session_recaps IS
  '#572 Episode recap skeleton — highlights + audience-safe adventure snapshot at complete.';

ALTER TABLE public.session_recaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view session recaps" ON public.session_recaps;
CREATE POLICY "Members can view session recaps" ON public.session_recaps
  FOR SELECT USING (
    public.is_session_participant(session_id, auth.uid())
  );

-- No direct client writes — SECURITY DEFINER RPCs only.
REVOKE ALL ON TABLE public.session_recaps FROM PUBLIC;
GRANT SELECT ON TABLE public.session_recaps TO authenticated;
GRANT ALL ON TABLE public.session_recaps TO service_role;

-- Build highlight array from adventure consequences (newest first, cap 20).
CREATE OR REPLACE FUNCTION public.sagadrive_build_recap_highlight_lines(
  p_adventure JSONB,
  p_is_gm BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_out JSONB := '[]'::jsonb;
  v_elem JSONB;
  v_vis TEXT;
BEGIN
  FOR v_elem IN
    SELECT elem
    FROM jsonb_array_elements(COALESCE(p_adventure->'consequences', '[]'::jsonb)) AS elem
    ORDER BY COALESCE(elem->>'createdAt', '') DESC
    LIMIT 40
  LOOP
    v_vis := COALESCE(v_elem->>'visibility', 'gm_only');
    IF p_is_gm OR v_vis IN ('public', 'shared') THEN
      v_out := v_out || jsonb_build_array(
        jsonb_build_object(
          'id', COALESCE(v_elem->>'id', ''),
          'kind', COALESCE(v_elem->>'kind', 'generic'),
          'summary', COALESCE(v_elem->>'summary', ''),
          'visibility', v_vis
        )
      );
    END IF;
    IF jsonb_array_length(v_out) >= 20 THEN
      EXIT;
    END IF;
  END LOOP;
  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.sagadrive_build_recap_highlight_lines(JSONB, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sagadrive_build_recap_highlight_lines(JSONB, BOOLEAN) TO authenticated;

-- Idempotent upsert of recap skeleton from current session world_state.
CREATE OR REPLACE FUNCTION public.sagadrive_upsert_session_recap(p_session_id UUID)
RETURNS public.session_recaps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.sessions%ROWTYPE;
  v_adv JSONB;
  v_shared JSONB;
  v_lines JSONB;
  v_row public.session_recaps%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;

  v_shared := COALESCE(v_session.world_state->'shared', '{}'::jsonb);
  v_adv := COALESCE(v_shared->'adventure', '{}'::jsonb);
  IF jsonb_typeof(v_adv) IS DISTINCT FROM 'object' THEN
    v_adv := '{}'::jsonb;
  END IF;

  -- Persist latest adventure onto project for continuity (complete path).
  IF jsonb_typeof(v_adv) = 'object' AND COALESCE((v_adv->>'schemaVersion')::int, 0) = 1 THEN
    UPDATE public.projects
       SET adventure_runtime = v_adv,
           updated_at = NOW()
     WHERE id = v_session.project_id;
  END IF;

  -- Full adventure in snapshot; get_session_recap projects highlights by role.
  v_lines := public.sagadrive_build_recap_highlight_lines(v_adv, true);

  INSERT INTO public.session_recaps AS sr (
    session_id, summary_text, highlight_lines, snapshot, created_at, updated_at
  ) VALUES (
    p_session_id,
    NULL,
    v_lines,
    COALESCE(v_adv, '{}'::jsonb),
    NOW(),
    NOW()
  )
  ON CONFLICT (session_id) DO UPDATE
    SET highlight_lines = EXCLUDED.highlight_lines,
        snapshot = EXCLUDED.snapshot,
        updated_at = NOW(),
        -- keep manual summary_text if already set
        summary_text = sr.summary_text
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.sagadrive_upsert_session_recap(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sagadrive_upsert_session_recap(UUID) TO authenticated;

-- Membership-gated recap read with audience-projected highlights.
CREATE OR REPLACE FUNCTION public.get_session_recap(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session public.sessions%ROWTYPE;
  v_is_gm BOOLEAN;
  v_recap public.session_recaps%ROWTYPE;
  v_lines JSONB;
  v_adv JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_session_participant(p_session_id, v_user) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_is_gm := public.is_project_gm(v_session.project_id, v_user);

  SELECT * INTO v_recap FROM public.session_recaps WHERE session_id = p_session_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_adv := COALESCE(v_recap.snapshot, '{}'::jsonb);
  v_lines := public.sagadrive_build_recap_highlight_lines(v_adv, v_is_gm);

  RETURN jsonb_build_object(
    'sessionId', v_recap.session_id,
    'summaryText', v_recap.summary_text,
    'highlightLines', v_lines,
    'createdAt', v_recap.created_at,
    'updatedAt', v_recap.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_session_recap(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_session_recap(UUID) TO authenticated;

-- Optional GM summary edit (manual; AI is #573).
CREATE OR REPLACE FUNCTION public.save_session_recap_summary(
  p_session_id UUID,
  p_summary_text TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session public.sessions%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.is_project_gm(v_session.project_id, v_user) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.session_recaps (session_id, summary_text, highlight_lines, snapshot)
  VALUES (p_session_id, NULLIF(BTRIM(COALESCE(p_summary_text, '')), ''), '[]'::jsonb, '{}'::jsonb)
  ON CONFLICT (session_id) DO UPDATE
    SET summary_text = EXCLUDED.summary_text,
        updated_at = NOW();

  RETURN public.get_session_recap(p_session_id);
END;
$$;

REVOKE ALL ON FUNCTION public.save_session_recap_summary(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_session_recap_summary(UUID, TEXT) TO authenticated;

-- Patch status transition: on complete → upsert recap.
CREATE OR REPLACE FUNCTION public.set_session_status(p_session_id UUID, p_status TEXT)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor UUID := auth.uid();
  v_session public.sessions;
  v_from TEXT;
  v_revision BIGINT;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('waiting', 'active', 'paused', 'completed') THEN
    RAISE EXCEPTION 'Invalid session status' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.is_project_gm(v_session.project_id, actor) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  v_from := v_session.status;
  IF v_from = 'scheduled' THEN v_from := 'waiting'; END IF;
  IF v_from = 'completed' THEN RAISE EXCEPTION 'Completed sessions cannot change status' USING ERRCODE = '22023'; END IF;
  IF NOT (
    (v_from = 'waiting' AND p_status IN ('active', 'completed'))
    OR (v_from = 'active' AND p_status IN ('paused', 'completed'))
    OR (v_from = 'paused' AND p_status IN ('active', 'completed'))
  ) THEN
    RAISE EXCEPTION 'Illegal status transition from % to %', v_from, p_status USING ERRCODE = '22023';
  END IF;

  v_revision := COALESCE(v_session.runtime_revision, 0) + 1;

  UPDATE public.sessions SET
    status = p_status,
    runtime_revision = v_revision,
    updated_at = NOW(),
    started_at = CASE WHEN p_status = 'active' AND started_at IS NULL THEN NOW() ELSE started_at END,
    ended_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE ended_at END
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  PERFORM public.append_session_event(
    p_session_id,
    'status',
    actor,
    jsonb_build_object('from', v_from, 'to', p_status),
    v_revision,
    NULL
  );

  IF p_status = 'completed' THEN
    PERFORM public.sagadrive_upsert_session_recap(p_session_id);
  END IF;

  RETURN v_session;
END;
$$;

REVOKE ALL ON FUNCTION public.set_session_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_session_status(UUID, TEXT) TO authenticated;

-- Next session inherits project adventure (+ knowledge from latest completed session when present).
CREATE OR REPLACE FUNCTION public.create_project_session(
  p_project_id UUID,
  p_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created public.sessions;
  actor UUID := auth.uid();
  is_member BOOLEAN := false;
  v_adv JSONB := '{}'::jsonb;
  v_knowledge JSONB := NULL;
  v_world JSONB;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
     WHERE pm.project_id = p_project_id AND pm.user_id = actor AND pm.status = 'active' AND pm.role IN ('gm', 'player')
  ) OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = p_project_id AND p.gm_user_id = actor)
  INTO is_member;
  IF NOT is_member THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT COALESCE(adventure_runtime, '{}'::jsonb) INTO v_adv
  FROM public.projects WHERE id = p_project_id;
  IF jsonb_typeof(v_adv) IS DISTINCT FROM 'object' THEN
    v_adv := '{}'::jsonb;
  END IF;

  -- Carry knowledge from most recent completed session world_state when present.
  SELECT s.world_state->'shared'->'knowledge' INTO v_knowledge
  FROM public.sessions s
  WHERE s.project_id = p_project_id
    AND s.status = 'completed'
    AND s.world_state ? 'shared'
    AND (s.world_state->'shared') ? 'knowledge'
  ORDER BY s.session_number DESC
  LIMIT 1;

  v_world := jsonb_build_object(
    'shared',
    CASE
      WHEN v_knowledge IS NOT NULL AND jsonb_typeof(v_knowledge) = 'object' THEN
        jsonb_build_object('adventure', v_adv, 'knowledge', v_knowledge)
      ELSE
        jsonb_build_object('adventure', v_adv)
    END
  );

  INSERT INTO public.sessions (project_id, session_number, name, notes, status, code, world_state)
  VALUES (
    p_project_id,
    public.allocate_next_session_number(p_project_id),
    NULLIF(btrim(p_name), ''),
    NULLIF(btrim(p_notes), ''),
    'scheduled',
    public.generate_unique_session_code(),
    v_world
  )
  RETURNING * INTO created;
  RETURN created;
END;
$$;

REVOKE ALL ON FUNCTION public.create_project_session(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project_session(UUID, TEXT, TEXT) TO authenticated;

-- Overview episodes: fill recapSnippet from persisted recap when present.
CREATE OR REPLACE FUNCTION public.get_saga_overview(p_public_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_open_sessions INT := 0;
  v_latest_session JSONB := NULL;
  v_primary JSONB;
  v_key TEXT;
  v_entry JSONB;
  v_cons_cap INT := 20;
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

  v_shared := jsonb_build_object(
    'adventure',
    COALESCE(v_project.adventure_runtime, '{}'::jsonb)
  );
  v_projected := public.sagadrive_project_shared_adventure(v_shared, v_is_gm);
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
        'sessionId', s.id,
        'sessionPublicId', s.public_id,
        'sessionNumber', s.session_number,
        'name', s.name,
        'status', s.status,
        'startedAt', s.started_at,
        'endedAt', s.ended_at,
        'recapSnippet', COALESCE(
          NULLIF(BTRIM(COALESCE(sr.summary_text, '')), ''),
          (
            SELECT elem->>'summary'
            FROM jsonb_array_elements(
              public.sagadrive_build_recap_highlight_lines(
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
    'primaryAction', v_primary,
    'episodes', v_episodes,
    'ensemble', v_ensemble,
    'worldStateSummary', jsonb_build_object(
      'clocks', v_clocks,
      'consequences', v_consequences,
      'flagCount', public.jsonb_object_keys_count(v_adv->'flags'),
      'updatedAt', v_adv->>'updatedAt'
    )
  );
END;
$$;

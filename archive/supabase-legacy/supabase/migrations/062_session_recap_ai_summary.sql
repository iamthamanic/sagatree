-- #573 — AI episode summary draft + GM approve; draft hidden from non-GM.

ALTER TABLE public.session_recaps
  ADD COLUMN IF NOT EXISTS summary_status TEXT NOT NULL DEFAULT 'none'
    CHECK (summary_status IN ('none', 'draft', 'approved'));

COMMENT ON COLUMN public.session_recaps.summary_status IS
  '#573 none|draft|approved — draft visible to GM only via get_session_recap';

-- Force RPC-only reads (draft must not leak via table SELECT).
DROP POLICY IF EXISTS "Members can view session recaps" ON public.session_recaps;
REVOKE ALL ON TABLE public.session_recaps FROM PUBLIC;
REVOKE ALL ON TABLE public.session_recaps FROM anon, authenticated;
GRANT ALL ON TABLE public.session_recaps TO service_role;

-- Persistent rate limit for session-recap edge function.
CREATE TABLE IF NOT EXISTS public.session_recap_rate_limits (
  user_id UUID PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.session_recap_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.session_recap_rate_limits FROM PUBLIC;
REVOKE ALL ON TABLE public.session_recap_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_session_recap_rate_limit(
  p_user_id UUID,
  p_limit INTEGER,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_count INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  IF p_limit < 1 OR p_limit > 60 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 60';
  END IF;
  IF p_window_seconds < 1 OR p_window_seconds > 3600 THEN
    RAISE EXCEPTION 'p_window_seconds must be between 1 and 3600';
  END IF;

  INSERT INTO public.session_recap_rate_limits AS limits (
    user_id, window_started_at, request_count, updated_at
  )
  VALUES (p_user_id, v_now, 1, v_now)
  ON CONFLICT (user_id) DO UPDATE
  SET
    window_started_at = CASE
      WHEN limits.window_started_at <= v_now - (p_window_seconds * INTERVAL '1 second') THEN v_now
      ELSE limits.window_started_at
    END,
    request_count = CASE
      WHEN limits.window_started_at <= v_now - (p_window_seconds * INTERVAL '1 second') THEN 1
      ELSE LEAST(limits.request_count + 1, p_limit + 1)
    END,
    updated_at = v_now
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_session_recap_rate_limit(UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_session_recap_rate_limit(UUID, INTEGER, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_session_recap_rate_limit(UUID, INTEGER, INTEGER) TO service_role;

-- Audience-safe recap read: non-GM only sees approved summary_text.
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
  v_summary TEXT;
  v_status TEXT;
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
  v_status := COALESCE(v_recap.summary_status, 'none');
  v_summary := v_recap.summary_text;

  IF NOT v_is_gm AND v_status IS DISTINCT FROM 'approved' THEN
    v_summary := NULL;
  END IF;

  RETURN jsonb_build_object(
    'sessionId', v_recap.session_id,
    'summaryText', v_summary,
    'summaryStatus', v_status,
    'highlightLines', v_lines,
    'createdAt', v_recap.created_at,
    'updatedAt', v_recap.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_session_recap(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_session_recap(UUID) TO authenticated;

-- GM save draft or approve summary.
CREATE OR REPLACE FUNCTION public.save_session_recap_summary(
  p_session_id UUID,
  p_summary_text TEXT,
  p_status TEXT DEFAULT 'draft'
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

REVOKE ALL ON FUNCTION public.save_session_recap_summary(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_session_recap_summary(UUID, TEXT, TEXT) TO authenticated;

-- Keep 2-arg overload for older clients → draft.
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

REVOKE ALL ON FUNCTION public.save_session_recap_summary(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_session_recap_summary(UUID, TEXT) TO authenticated;

-- Overview: non-GM snippets only from approved summaries (else projected highlight).
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
          CASE
            WHEN v_is_gm OR COALESCE(sr.summary_status, 'none') = 'approved' THEN
              NULLIF(BTRIM(COALESCE(sr.summary_text, '')), '')
            ELSE NULL
          END,
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

REVOKE ALL ON FUNCTION public.get_saga_overview(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saga_overview(TEXT) TO authenticated;

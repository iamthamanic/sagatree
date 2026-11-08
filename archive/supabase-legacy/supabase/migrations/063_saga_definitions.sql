-- #574 — Saga definitions + versions; projects pin a version; Dornhain native seed; backfill.
-- Note: design doc said 062_saga_definitions; 062 is session_recap_ai (#573) — this is 063.

CREATE TABLE IF NOT EXISTS public.saga_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  synopsis TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT 'user'
    CHECK (origin IN ('native', 'user', 'private_backfill')),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT saga_definitions_native_owner_chk CHECK (
    (origin = 'native' AND owner_user_id IS NULL)
    OR (origin <> 'native')
  )
);

CREATE TABLE IF NOT EXISTS public.saga_definition_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  saga_id UUID NOT NULL REFERENCES public.saga_definitions(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (saga_id, version_label)
);

CREATE INDEX IF NOT EXISTS saga_definition_versions_saga_idx
  ON public.saga_definition_versions (saga_id, status);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS saga_id UUID REFERENCES public.saga_definitions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS saga_version_id UUID REFERENCES public.saga_definition_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS projects_saga_id_idx ON public.projects (saga_id);

ALTER TABLE public.saga_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saga_definition_versions ENABLE ROW LEVEL SECURITY;

-- Definitions metadata readable; version payloads (gm_only) are RPC-only.
REVOKE ALL ON TABLE public.saga_definitions FROM PUBLIC;
REVOKE ALL ON TABLE public.saga_definition_versions FROM PUBLIC;
REVOKE ALL ON TABLE public.saga_definition_versions FROM anon, authenticated;
GRANT SELECT ON TABLE public.saga_definitions TO authenticated;
GRANT ALL ON TABLE public.saga_definitions TO service_role;
GRANT ALL ON TABLE public.saga_definition_versions TO service_role;

DROP POLICY IF EXISTS "Authenticated can read saga definition metadata" ON public.saga_definitions;
CREATE POLICY "Authenticated can read saga definition metadata" ON public.saga_definitions
  FOR SELECT TO authenticated
  USING (true);

-- Block client inserts of native origin.
CREATE OR REPLACE FUNCTION public.sagadrive_forbid_native_saga_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.origin = 'native' AND (auth.role() IS DISTINCT FROM 'service_role') THEN
    RAISE EXCEPTION 'native saga definitions are service_role only' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forbid_native_saga_insert ON public.saga_definitions;
CREATE TRIGGER trg_forbid_native_saga_insert
  BEFORE INSERT ON public.saga_definitions
  FOR EACH ROW EXECUTE FUNCTION public.sagadrive_forbid_native_saga_insert();

-- Audience-project definition payload (strip gm_only knowledge for non-GM).
CREATE OR REPLACE FUNCTION public.sagadrive_project_saga_definition_payload(
  p_payload JSONB,
  p_is_gm BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_out JSONB;
  v_facts JSONB := '[]'::jsonb;
  v_elem JSONB;
  v_vis TEXT;
BEGIN
  v_out := COALESCE(p_payload, '{}'::jsonb);
  IF jsonb_typeof(v_out->'knowledgeFacts') = 'array' THEN
    FOR v_elem IN SELECT elem FROM jsonb_array_elements(v_out->'knowledgeFacts') AS elem
    LOOP
      v_vis := COALESCE(v_elem->>'visibility', 'gm_only');
      IF p_is_gm OR v_vis IN ('public', 'discovered', 'shared') THEN
        v_facts := v_facts || jsonb_build_array(v_elem);
      END IF;
    END LOOP;
    v_out := jsonb_set(v_out, '{knowledgeFacts}', v_facts);
  END IF;
  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.sagadrive_project_saga_definition_payload(JSONB, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sagadrive_project_saga_definition_payload(JSONB, BOOLEAN) TO authenticated;

-- Membership-gated projected version read.
CREATE OR REPLACE FUNCTION public.get_saga_definition_version(
  p_version_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_ver public.saga_definition_versions%ROWTYPE;
  v_def public.saga_definitions%ROWTYPE;
  v_is_gm BOOLEAN := false;
  v_member BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ver FROM public.saga_definition_versions WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saga-Fassung nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_def FROM public.saga_definitions WHERE id = v_ver.saga_id;

  -- Access: native published readable to any authenticated; else owner or project member on that saga.
  IF v_def.origin = 'native' AND v_ver.status = 'published' THEN
    v_member := true;
  ELSIF v_def.owner_user_id = v_user THEN
    v_member := true;
    v_is_gm := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.saga_id = v_def.id
        AND (
          p.gm_user_id = v_user
          OR public.current_user_is_active_project_member(p.id)
        )
    ) INTO v_member;
    SELECT EXISTS (
      SELECT 1 FROM public.projects p WHERE p.saga_id = v_def.id AND p.gm_user_id = v_user
    ) INTO v_is_gm;
  END IF;

  IF NOT v_member THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Native: treat requester as GM only if they GM a project on this saga (else player projection).
  IF v_def.origin = 'native' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.projects p WHERE p.saga_id = v_def.id AND p.gm_user_id = v_user
    ) INTO v_is_gm;
  END IF;

  RETURN jsonb_build_object(
    'sagaId', v_def.id,
    'sagaSlug', v_def.slug,
    'title', v_def.title,
    'synopsis', v_def.synopsis,
    'origin', v_def.origin,
    'versionId', v_ver.id,
    'versionLabel', v_ver.version_label,
    'status', v_ver.status,
    'payload', public.sagadrive_project_saga_definition_payload(v_ver.payload, v_is_gm),
    'isGmProjection', v_is_gm
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_saga_definition_version(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saga_definition_version(UUID) TO authenticated;

-- Convenience: Dornhain published version by slug (for panel instantiate).
CREATE OR REPLACE FUNCTION public.get_native_saga_definition_by_slug(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ver_id UUID;
BEGIN
  SELECT v.id INTO v_ver_id
  FROM public.saga_definitions d
  JOIN public.saga_definition_versions v ON v.saga_id = d.id
  WHERE d.slug = BTRIM(p_slug)
    AND d.origin = 'native'
    AND v.status = 'published'
  ORDER BY v.published_at DESC NULLS LAST
  LIMIT 1;
  IF v_ver_id IS NULL THEN
    RAISE EXCEPTION 'Native Saga nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  RETURN public.get_saga_definition_version(v_ver_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_native_saga_definition_by_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_native_saga_definition_by_slug(TEXT) TO authenticated;

-- Create a new group run pinned to a published version.
CREATE OR REPLACE FUNCTION public.create_project_from_saga_version(
  p_saga_id UUID,
  p_version_id UUID,
  p_name TEXT DEFAULT NULL
)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  v_def public.saga_definitions%ROWTYPE;
  v_ver public.saga_definition_versions%ROWTYPE;
  created public.projects;
  v_name TEXT;
  v_adv JSONB := '{}'::jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_def FROM public.saga_definitions WHERE id = p_saga_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saga not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_ver FROM public.saga_definition_versions
   WHERE id = p_version_id AND saga_id = p_saga_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fassung not found' USING ERRCODE = 'P0002'; END IF;
  IF v_ver.status <> 'published' THEN
    RAISE EXCEPTION 'Nur veröffentlichte Fassungen' USING ERRCODE = '22023';
  END IF;

  IF v_def.origin NOT IN ('native', 'user') AND v_def.owner_user_id IS DISTINCT FROM actor THEN
    -- private_backfill: only owner may spawn another group
    IF v_def.owner_user_id IS DISTINCT FROM actor THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_name := NULLIF(BTRIM(COALESCE(p_name, '')), '');
  IF v_name IS NULL THEN
    v_name := v_def.title || ' · Gruppe';
  END IF;

  IF jsonb_typeof(v_ver.payload->'initialAdventure') = 'object' THEN
    v_adv := v_ver.payload->'initialAdventure';
  END IF;

  INSERT INTO public.projects (
    code, name, description, gm_user_id, status, saga_id, saga_version_id, adventure_runtime
  ) VALUES (
    NULL, -- trigger generate_project_code
    v_name,
    v_def.synopsis,
    actor,
    'active',
    v_def.id,
    v_ver.id,
    v_adv
  )
  RETURNING * INTO created;

  INSERT INTO public.project_members (project_id, user_id, role, status)
  VALUES (created.id, actor, 'gm', 'active');

  RETURN created;
END;
$$;

REVOKE ALL ON FUNCTION public.create_project_from_saga_version(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project_from_saga_version(UUID, UUID, TEXT) TO authenticated;

-- Fixed UUIDs for idempotent Dornhain seed.
-- Bypass trg_forbid_native_saga_insert: migration apply runs as postgres, not service_role.
ALTER TABLE public.saga_definitions DISABLE TRIGGER trg_forbid_native_saga_insert;
DO $$
DECLARE
  v_saga_id UUID := 'a5740000-0000-4000-8000-00000000d001';
  v_ver_id UUID := 'a5740000-0000-4000-8000-00000000d002';
  v_payload JSONB;
BEGIN
  v_payload := jsonb_build_object(
    'packageId', 'package:dornhain.whisper.v1',
    'schemaVersion', 1,
    'title', 'Das Flüstern unter Dornhain',
    'synopsis', 'Fantasy-Mystery-Sandbox (60–90 Min): Verschwinden, falsche Banditen-Schuld, geöffnetes Relikt, verborgene Beteiligung und eskalierende Gefahr — freie Reihenfolge der Orte.',
    'locations', jsonb_build_array(
      jsonb_build_object('id', 'loc.tavern', 'label', 'Taverne Zum Flüstern'),
      jsonb_build_object('id', 'loc.market', 'label', 'Marktplatz Dornhain'),
      jsonb_build_object('id', 'loc.woods', 'label', 'Schattenwald'),
      jsonb_build_object('id', 'loc.crypt', 'label', 'Krypta unter dem Hügel'),
      jsonb_build_object('id', 'loc.bandit-camp', 'label', 'Banditenlager (falsche Spur)')
    ),
    'knowledgeFacts', jsonb_build_array(
      jsonb_build_object('id', 'fact.disappearances', 'visibility', 'public', 'summary', 'In Dornhain verschwinden Menschen — die Stadt ist nervös.'),
      jsonb_build_object('id', 'fact.bandits-suspected', 'visibility', 'discovered', 'summary', 'Viele verdächtigen Banditen — sie sind nicht die eigentliche Ursache.'),
      jsonb_build_object('id', 'fact.relic-opened', 'visibility', 'gm_only', 'summary', 'Ein Relikt wurde geöffnet; die Gefahr eskaliert mit der Zeit.'),
      jsonb_build_object('id', 'fact.hidden-npc', 'visibility', 'gm_only', 'summary', 'Ein vertrauter Dorfbewohner ist in die Reliktöffnung verwickelt.')
    ),
    'escalationClocks', jsonb_build_array(
      jsonb_build_object('id', 'danger', 'label', 'Reliktgefahr', 'max', 6),
      jsonb_build_object('id', 'suspicion', 'label', 'Dorfverdacht', 'max', 4)
    )
  );

  INSERT INTO public.saga_definitions (id, slug, title, synopsis, origin, owner_user_id)
  VALUES (
    v_saga_id,
    'dornhain.whisper',
    'Das Flüstern unter Dornhain',
    'Fantasy-Mystery-Sandbox (60–90 Min).',
    'native',
    NULL
  )
  ON CONFLICT (slug) DO UPDATE
    SET title = EXCLUDED.title,
        synopsis = EXCLUDED.synopsis,
        updated_at = NOW();

  INSERT INTO public.saga_definition_versions (
    id, saga_id, version_label, status, payload, published_at
  ) VALUES (
    v_ver_id, v_saga_id, 'v1', 'published', v_payload, NOW()
  )
  ON CONFLICT (saga_id, version_label) DO UPDATE
    SET payload = EXCLUDED.payload,
        status = 'published',
        published_at = COALESCE(public.saga_definition_versions.published_at, NOW());
END;
$$;
ALTER TABLE public.saga_definitions ENABLE TRIGGER trg_forbid_native_saga_insert;

-- Backfill: each project without saga_id gets a private definition from name/description.
DO $$
DECLARE
  r RECORD;
  v_saga_id UUID;
  v_ver_id UUID;
  v_slug TEXT;
BEGIN
  FOR r IN
    SELECT id, name, description, gm_user_id
    FROM public.projects
    WHERE saga_id IS NULL
  LOOP
    v_saga_id := gen_random_uuid();
    v_ver_id := gen_random_uuid();
    v_slug := 'private.' || replace(r.id::text, '-', '');

    INSERT INTO public.saga_definitions (id, slug, title, synopsis, origin, owner_user_id)
    VALUES (
      v_saga_id,
      v_slug,
      COALESCE(NULLIF(BTRIM(r.name), ''), 'Saga'),
      COALESCE(r.description, ''),
      'private_backfill',
      r.gm_user_id
    );

    INSERT INTO public.saga_definition_versions (
      id, saga_id, version_label, status, payload, published_at
    ) VALUES (
      v_ver_id,
      v_saga_id,
      'v1',
      'published',
      jsonb_build_object(
        'title', COALESCE(NULLIF(BTRIM(r.name), ''), 'Saga'),
        'synopsis', COALESCE(r.description, ''),
        'knowledgeFacts', '[]'::jsonb,
        'locations', '[]'::jsonb
      ),
      NOW()
    );

    UPDATE public.projects
       SET saga_id = v_saga_id,
           saga_version_id = v_ver_id
     WHERE id = r.id;
  END LOOP;
END;
$$;


-- Patch overview with saga definition pin metadata (#574).
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
    'sagaDefinitionId', v_saga_def_id,
    'sagaVersionId', v_saga_ver_id,
    'versionLabel', v_version_label,
    'newerVersionAvailable', v_newer,
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

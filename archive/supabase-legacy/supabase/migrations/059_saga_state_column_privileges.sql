-- #569 — Column privileges for saga/session runtime secrets.
-- Table-level SELECT must be converted to an allow-list: PostgreSQL does not
-- honor REVOKE SELECT (col) while table-level SELECT remains.
-- Audience-projected reads stay on SECURITY DEFINER RPCs
-- (get_session_runtime_snapshot / adventure pipeline).

-- Ensure runtime column exists so privileges can be denied explicitly.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS adventure_runtime JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- projects: revoke table SELECT, grant safe columns only
-- ---------------------------------------------------------------------------
REVOKE SELECT ON TABLE public.projects FROM PUBLIC;
REVOKE SELECT ON TABLE public.projects FROM anon;
REVOKE SELECT ON TABLE public.projects FROM authenticated;

DO $$
DECLARE
  cols TEXT[] := ARRAY[
    'id',
    'public_id',
    'code',
    'name',
    'description',
    'world_id',
    'world_profile_id',
    'default_look_profile_id',
    'allow_player_character_look_override',
    'gm_user_id',
    'status',
    'settings',
    'created_at',
    'updated_at'
  ];
  existing TEXT[];
  col TEXT;
BEGIN
  existing := ARRAY[]::TEXT[];
  FOREACH col IN ARRAY cols LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'projects'
        AND c.column_name = col
    ) THEN
      existing := existing || col;
    END IF;
  END LOOP;

  IF COALESCE(array_length(existing, 1), 0) = 0 THEN
    RAISE EXCEPTION '059: no safe projects columns found to GRANT SELECT';
  END IF;

  EXECUTE format(
    'GRANT SELECT (%s) ON TABLE public.projects TO authenticated',
    array_to_string(existing, ', ')
  );
END $$;

-- ---------------------------------------------------------------------------
-- sessions: revoke table SELECT, grant safe columns only (no world_state/notes)
-- ---------------------------------------------------------------------------
REVOKE SELECT ON TABLE public.sessions FROM PUBLIC;
REVOKE SELECT ON TABLE public.sessions FROM anon;
REVOKE SELECT ON TABLE public.sessions FROM authenticated;

DO $$
DECLARE
  cols TEXT[] := ARRAY[
    'id',
    'public_id',
    'project_id',
    'session_number',
    'name',
    'description',
    'status',
    'started_at',
    'ended_at',
    'duration_minutes',
    'look_profile_id',
    'code',
    'created_at',
    'updated_at'
  ];
  existing TEXT[];
  col TEXT;
BEGIN
  existing := ARRAY[]::TEXT[];
  FOREACH col IN ARRAY cols LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'sessions'
        AND c.column_name = col
    ) THEN
      existing := existing || col;
    END IF;
  END LOOP;

  IF COALESCE(array_length(existing, 1), 0) = 0 THEN
    RAISE EXCEPTION '059: no safe sessions columns found to GRANT SELECT';
  END IF;

  EXECUTE format(
    'GRANT SELECT (%s) ON TABLE public.sessions TO authenticated',
    array_to_string(existing, ', ')
  );
END $$;

GRANT ALL ON TABLE public.projects TO service_role;
GRANT ALL ON TABLE public.sessions TO service_role;

COMMENT ON COLUMN public.projects.adventure_runtime IS
  'Saga continuity runtime JSON. Not selectable by authenticated/anon; use projected session RPCs.';

COMMENT ON COLUMN public.sessions.world_state IS
  'Live session world_state JSON. Not selectable by authenticated/anon; use get_session_runtime_snapshot.';

COMMENT ON COLUMN public.sessions.notes IS
  'GM session notes. Not selectable by authenticated/anon.';

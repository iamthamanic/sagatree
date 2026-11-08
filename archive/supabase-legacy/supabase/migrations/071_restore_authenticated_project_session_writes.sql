-- #603 — Restore authenticated INSERT/UPDATE on projects/sessions after 059,
-- without re-exposing adventure_runtime / world_state / notes via SELECT.
-- Also grant SELECT on saga_* columns added after 059 (#574).

-- Table-level writes (RLS still applies). Column SELECT stays an allow-list.
GRANT INSERT, UPDATE, DELETE ON TABLE public.projects TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.sessions TO authenticated;

-- Re-assert SELECT allow-list (safe columns only).
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
    'saga_id',
    'saga_version_id',
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
    RAISE EXCEPTION '071: no safe projects columns found to GRANT SELECT';
  END IF;

  EXECUTE format(
    'GRANT SELECT (%s) ON TABLE public.projects TO authenticated',
    array_to_string(existing, ', ')
  );
END $$;

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
    'runtime_revision',
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
    RAISE EXCEPTION '071: no safe sessions columns found to GRANT SELECT';
  END IF;

  EXECUTE format(
    'GRANT SELECT (%s) ON TABLE public.sessions TO authenticated',
    array_to_string(existing, ', ')
  );
END $$;

-- Explicitly keep secrets unreadable (belt + suspenders if table SELECT ever returns).
REVOKE SELECT (adventure_runtime) ON TABLE public.projects FROM authenticated, anon;
REVOKE SELECT (world_state, notes) ON TABLE public.sessions FROM authenticated, anon;

GRANT ALL ON TABLE public.projects TO service_role;
GRANT ALL ON TABLE public.sessions TO service_role;

COMMENT ON COLUMN public.projects.adventure_runtime IS
  'Saga continuity runtime JSON. Not selectable by authenticated/anon; use projected RPCs (#569/#603).';
COMMENT ON COLUMN public.sessions.world_state IS
  'Live session world_state JSON. Not selectable by authenticated/anon (#569/#603).';
COMMENT ON COLUMN public.sessions.notes IS
  'GM session notes. Not selectable by authenticated/anon (#569/#603).';

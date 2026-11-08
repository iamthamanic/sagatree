-- Harden project membership so client-writable rows cannot become authorization grants.
-- Compatible with both the legacy self-host schema and Schema V3 deployments.

CREATE OR REPLACE FUNCTION public.current_user_is_active_project_member(
  p_project_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_active_project_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_is_active_project_member(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_active_project_member(UUID) TO authenticated;

-- Project codes are looked up case-insensitively. Enforce the same uniqueness rule in
-- storage so ABC123 and abc123 can never resolve to different projects. Existing
-- collisions fail the migration explicitly instead of assigning a join arbitrarily.
DO $$
DECLARE
  v_duplicate_codes TEXT;
BEGIN
  SELECT string_agg(normalized_code, ', ' ORDER BY normalized_code)
  INTO v_duplicate_codes
  FROM (
    SELECT UPPER(BTRIM(code)) AS normalized_code
    FROM public.projects
    GROUP BY UPPER(BTRIM(code))
    HAVING COUNT(*) > 1
  ) duplicates;

  IF v_duplicate_codes IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot enforce case-insensitive project-code uniqueness; duplicate normalized codes exist: %',
      v_duplicate_codes;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_code_casefold_unique
  ON public.projects ((UPPER(BTRIM(code))));

-- Normalize project visibility across the legacy and V3 policy names. A kicked/inactive
-- membership is not enough to read a project anymore.
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects where they are GM" ON public.projects;
DROP POLICY IF EXISTS "Active members can view their projects" ON public.projects;

CREATE POLICY "Users can view projects where they are GM"
  ON public.projects FOR SELECT
  USING (gm_user_id = auth.uid());

CREATE POLICY "Active members can view their projects"
  ON public.projects FOR SELECT
  USING (public.current_user_is_active_project_member(id));

-- Remove the old V3 self-service policies that let a browser choose protected
-- membership fields. The legacy schema already restricts writes to GMs only.
DROP POLICY IF EXISTS "Users can join projects" ON public.project_members;
DROP POLICY IF EXISTS "Users can update their member record" ON public.project_members;
DROP POLICY IF EXISTS "Users can leave projects" ON public.project_members;
DROP POLICY IF EXISTS "GM can add members to their projects" ON public.project_members;
DROP POLICY IF EXISTS "GM can update members in their projects" ON public.project_members;
DROP POLICY IF EXISTS "Users can leave active project memberships" ON public.project_members;

CREATE POLICY "GM can add members to their projects"
  ON public.project_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.projects
      WHERE projects.id = project_members.project_id
        AND projects.gm_user_id = auth.uid()
    )
  );

CREATE POLICY "GM can update members in their projects"
  ON public.project_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects
      WHERE projects.id = project_members.project_id
        AND projects.gm_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.projects
      WHERE projects.id = project_members.project_id
        AND projects.gm_user_id = auth.uid()
    )
  );

-- Only an active member may voluntarily leave. Inactive/kicked rows remain controlled
-- denial records so suspension cannot be bypassed via delete + rejoin.
CREATE POLICY "Users can leave active project memberships"
  ON public.project_members FOR DELETE
  USING (
    user_id = auth.uid()
    AND status = 'active'
  );

-- Legacy self-host databases initialized from 001_initial.sql used membership existence
-- as an authorization grant in several policies. Recreate every affected policy so a
-- kicked/inactive row cannot continue to expose characters, sessions, memories, combat,
-- session-player state, or chat. This block is intentionally conditional because Schema
-- V3 has a different character/session model and already carries active-status policies.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'characters'
      AND column_name = 'is_public'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their characters" ON public.characters';
    EXECUTE $policy$
      CREATE POLICY "Users can view their characters" ON public.characters
        FOR SELECT USING (
          owner_user_id = auth.uid()
          OR is_public = true
          OR (
            project_id IS NOT NULL
            AND (
              project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid())
              OR public.current_user_is_active_project_member(project_id)
            )
          )
        )
    $policy$;

    EXECUTE 'DROP POLICY IF EXISTS "Users can view their sessions" ON public.sessions';
    EXECUTE $policy$
      CREATE POLICY "Users can view their sessions" ON public.sessions
        FOR SELECT USING (
          project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid())
          OR public.current_user_is_active_project_member(project_id)
        )
    $policy$;

    IF to_regclass('public.session_players') IS NOT NULL THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view session players" ON public.session_players';
      EXECUTE $policy$
        CREATE POLICY "Users can view session players" ON public.session_players
          FOR SELECT USING (
            session_id IN (
              SELECT id
              FROM public.sessions
              WHERE project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid())
            )
            OR (
              user_id = auth.uid()
              AND session_id IN (
                SELECT id
                FROM public.sessions
                WHERE public.current_user_is_active_project_member(project_id)
              )
            )
          )
      $policy$;
    END IF;

    IF to_regclass('public.npc_memories') IS NOT NULL THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view NPC memories" ON public.npc_memories';
      EXECUTE $policy$
        CREATE POLICY "Users can view NPC memories" ON public.npc_memories
          FOR SELECT USING (
            session_id IN (
              SELECT id
              FROM public.sessions
              WHERE project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid())
                 OR public.current_user_is_active_project_member(project_id)
            )
          )
      $policy$;
    END IF;

    IF to_regclass('public.combat_states') IS NOT NULL THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view combat states" ON public.combat_states';
      EXECUTE $policy$
        CREATE POLICY "Users can view combat states" ON public.combat_states
          FOR SELECT USING (
            session_id IN (
              SELECT id
              FROM public.sessions
              WHERE project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid())
                 OR public.current_user_is_active_project_member(project_id)
            )
          )
      $policy$;
    END IF;

    IF to_regclass('public.chat_messages') IS NOT NULL THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view chat messages" ON public.chat_messages';
      EXECUTE $policy$
        CREATE POLICY "Users can view chat messages" ON public.chat_messages
          FOR SELECT USING (
            session_id IN (
              SELECT id
              FROM public.sessions
              WHERE project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid())
                 OR public.current_user_is_active_project_member(project_id)
            )
          )
      $policy$;

      EXECUTE 'DROP POLICY IF EXISTS "Users can insert chat messages" ON public.chat_messages';
      EXECUTE $policy$
        CREATE POLICY "Users can insert chat messages" ON public.chat_messages
          FOR INSERT WITH CHECK (
            user_id = auth.uid()
            AND session_id IN (
              SELECT id
              FROM public.sessions
              WHERE project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid())
                 OR public.current_user_is_active_project_member(project_id)
            )
          )
      $policy$;
    END IF;
  END IF;
END;
$$;

-- Joining by a secret code is the only authenticated self-service operation that can
-- create an active membership. The caller cannot choose user_id, project_id, role or status.
CREATE OR REPLACE FUNCTION public.join_project_by_code(
  p_code TEXT,
  p_character_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_project_id UUID;
  v_existing_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(BTRIM(p_code), '') IS NULL THEN
    RAISE EXCEPTION 'Project code is required' USING ERRCODE = '22023';
  END IF;

  SELECT id
  INTO v_project_id
  FROM public.projects
  WHERE UPPER(BTRIM(code)) = UPPER(BTRIM(p_code))
    AND status = 'active';

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT status
  INTO v_existing_status
  FROM public.project_members
  WHERE project_id = v_project_id
    AND user_id = v_user_id;

  IF FOUND THEN
    RAISE EXCEPTION 'Project membership already exists with status %', v_existing_status
      USING ERRCODE = 'P0001';
  END IF;

  IF p_character_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.characters
    WHERE id = p_character_id
      AND owner_user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Character is not owned by the current user' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.project_members (
    project_id,
    user_id,
    character_id,
    role,
    status
  ) VALUES (
    v_project_id,
    v_user_id,
    p_character_id,
    'player',
    'active'
  );

  RETURN v_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_project_by_code(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_project_by_code(TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_project_by_code(TEXT, UUID) TO authenticated;

-- The browser may change only the selected character on its own active membership.
CREATE OR REPLACE FUNCTION public.set_my_project_character(
  p_project_id UUID,
  p_character_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_member_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_character_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.characters
    WHERE id = p_character_id
      AND owner_user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Character is not owned by the current user' USING ERRCODE = '42501';
  END IF;

  UPDATE public.project_members
  SET character_id = p_character_id
  WHERE project_id = p_project_id
    AND user_id = v_user_id
    AND status = 'active'
  RETURNING id INTO v_member_id;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Active project membership not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_member_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_project_character(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_my_project_character(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_my_project_character(UUID, UUID) TO authenticated;
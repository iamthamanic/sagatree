-- #fix-projects-rls-recursion
-- Break infinite recursion: projects SELECT ↔ project_members SELECT.
--
-- Cycle (observed live):
--   projects "Users can view their own projects"
--     → SELECT project_members
--   project_members "Users can view project members" / "GMs can manage…"
--     → SELECT projects
--     → recurse
--
-- Fix: drop legacy subquery policies; keep GM column check + SECURITY DEFINER helpers.

-- Re-assert helpers (bypass RLS when evaluating membership from policies).
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

CREATE OR REPLACE FUNCTION public.is_project_gm(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id AND p.gm_user_id = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = p_project_id
      AND pm.user_id = p_user_id
      AND pm.status = 'active'
      AND pm.role = 'gm'
  );
$$;

REVOKE ALL ON FUNCTION public.is_project_gm(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_project_gm(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- projects SELECT: no subquery into project_members (use DEFINER helper only)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects where they are GM" ON public.projects;
DROP POLICY IF EXISTS "Active members can view their projects" ON public.projects;

CREATE POLICY "Users can view projects where they are GM"
  ON public.projects FOR SELECT
  TO authenticated
  USING (gm_user_id = auth.uid());

CREATE POLICY "Active members can view their projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (public.current_user_is_active_project_member(id));

-- ---------------------------------------------------------------------------
-- project_members: no subquery into projects (use DEFINER is_project_gm)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view project members" ON public.project_members;
DROP POLICY IF EXISTS "GMs can manage project members" ON public.project_members;
DROP POLICY IF EXISTS "GM can add members to their projects" ON public.project_members;
DROP POLICY IF EXISTS "GM can update members in their projects" ON public.project_members;
DROP POLICY IF EXISTS "Users can leave active project memberships" ON public.project_members;

CREATE POLICY "Users can view project members"
  ON public.project_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_project_gm(project_id, auth.uid())
  );

CREATE POLICY "GM can add members to their projects"
  ON public.project_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_gm(project_id, auth.uid()));

CREATE POLICY "GM can update members in their projects"
  ON public.project_members FOR UPDATE
  TO authenticated
  USING (public.is_project_gm(project_id, auth.uid()))
  WITH CHECK (public.is_project_gm(project_id, auth.uid()));

CREATE POLICY "Users can leave active project memberships"
  ON public.project_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'active'
  );

COMMENT ON FUNCTION public.current_user_is_active_project_member(UUID) IS
  'SECURITY DEFINER membership probe — must not recurse via projects RLS.';
COMMENT ON FUNCTION public.is_project_gm(UUID, UUID) IS
  'SECURITY DEFINER GM probe — must not recurse via project_members/projects RLS.';

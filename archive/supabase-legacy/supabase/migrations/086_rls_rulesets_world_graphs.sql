-- #669 Security checklist 02/08: Enable RLS on rulesets + world_graphs.
-- These tables were created in 001_initial without ENABLE ROW LEVEL SECURITY.
-- Scope: project GM or active project member (SELECT); mutations = GM only.
-- Default deny for anon / non-members. Service role bypasses RLS intentionally.

-- ---------------------------------------------------------------------------
-- rulesets
-- ---------------------------------------------------------------------------
ALTER TABLE public.rulesets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rulesets_select_member_or_gm" ON public.rulesets;
DROP POLICY IF EXISTS "rulesets_insert_gm" ON public.rulesets;
DROP POLICY IF EXISTS "rulesets_update_gm" ON public.rulesets;
DROP POLICY IF EXISTS "rulesets_delete_gm" ON public.rulesets;

CREATE POLICY "rulesets_select_member_or_gm"
  ON public.rulesets
  FOR SELECT
  TO authenticated
  USING (
    project_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.projects
        WHERE projects.id = rulesets.project_id
          AND projects.gm_user_id = auth.uid()
      )
      OR public.current_user_is_active_project_member(project_id)
    )
  );

CREATE POLICY "rulesets_insert_gm"
  ON public.rulesets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.projects
      WHERE projects.id = rulesets.project_id
        AND projects.gm_user_id = auth.uid()
    )
  );

CREATE POLICY "rulesets_update_gm"
  ON public.rulesets
  FOR UPDATE
  TO authenticated
  USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.projects
      WHERE projects.id = rulesets.project_id
        AND projects.gm_user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.projects
      WHERE projects.id = rulesets.project_id
        AND projects.gm_user_id = auth.uid()
    )
  );

CREATE POLICY "rulesets_delete_gm"
  ON public.rulesets
  FOR DELETE
  TO authenticated
  USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.projects
      WHERE projects.id = rulesets.project_id
        AND projects.gm_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- world_graphs
-- ---------------------------------------------------------------------------
ALTER TABLE public.world_graphs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "world_graphs_select_member_or_gm" ON public.world_graphs;
DROP POLICY IF EXISTS "world_graphs_insert_gm" ON public.world_graphs;
DROP POLICY IF EXISTS "world_graphs_update_gm" ON public.world_graphs;
DROP POLICY IF EXISTS "world_graphs_delete_gm" ON public.world_graphs;

CREATE POLICY "world_graphs_select_member_or_gm"
  ON public.world_graphs
  FOR SELECT
  TO authenticated
  USING (
    project_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.projects
        WHERE projects.id = world_graphs.project_id
          AND projects.gm_user_id = auth.uid()
      )
      OR public.current_user_is_active_project_member(project_id)
    )
  );

CREATE POLICY "world_graphs_insert_gm"
  ON public.world_graphs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.projects
      WHERE projects.id = world_graphs.project_id
        AND projects.gm_user_id = auth.uid()
    )
  );

CREATE POLICY "world_graphs_update_gm"
  ON public.world_graphs
  FOR UPDATE
  TO authenticated
  USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.projects
      WHERE projects.id = world_graphs.project_id
        AND projects.gm_user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.projects
      WHERE projects.id = world_graphs.project_id
        AND projects.gm_user_id = auth.uid()
    )
  );

CREATE POLICY "world_graphs_delete_gm"
  ON public.world_graphs
  FOR DELETE
  TO authenticated
  USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.projects
      WHERE projects.id = world_graphs.project_id
        AND projects.gm_user_id = auth.uid()
    )
  );

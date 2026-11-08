-- 031: Meshy avatar jobs — clients must not mutate job rows (Edge/service_role only).
-- Fixes confused-deputy: authenticated UPDATE could rewrite storage_path / task ids,
-- then poll would service-role-sign an arbitrary object path.

DROP POLICY IF EXISTS "Owners update own meshy avatar jobs" ON public.character_avatar_meshy_jobs;
DROP POLICY IF EXISTS "Owners insert own meshy avatar jobs" ON public.character_avatar_meshy_jobs;

-- Keep owner SELECT so the UI can optionally read own jobs; all writes go via Edge + service_role.
COMMENT ON TABLE public.character_avatar_meshy_jobs IS
  'Meshy avatar jobs: owner SELECT only via RLS; INSERT/UPDATE via service_role Edge only (#10 security).';

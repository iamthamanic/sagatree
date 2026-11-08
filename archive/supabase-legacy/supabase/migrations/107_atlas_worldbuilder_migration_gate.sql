-- #723: per-world migration gate (default OFF) + read-only dry-run helper.
-- Expand-only. Does not rewrite places/maps. Apply remediations are separate
-- and must be explicitly enabled per world_profile_id after dry-run review.

CREATE TABLE IF NOT EXISTS public.atlas_wb_migration_gates (
  world_profile_id UUID PRIMARY KEY REFERENCES public.world_profiles(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.atlas_wb_migration_gates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atlas_wb_migration_gates_owner_select ON public.atlas_wb_migration_gates;
CREATE POLICY atlas_wb_migration_gates_owner_select
  ON public.atlas_wb_migration_gates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.world_profiles wp
      WHERE wp.id = world_profile_id
        AND wp.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS atlas_wb_migration_gates_owner_write ON public.atlas_wb_migration_gates;
CREATE POLICY atlas_wb_migration_gates_owner_write
  ON public.atlas_wb_migration_gates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.world_profiles wp
      WHERE wp.id = world_profile_id
        AND wp.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.world_profiles wp
      WHERE wp.id = world_profile_id
        AND wp.owner_user_id = auth.uid()
    )
  );

REVOKE ALL ON TABLE public.atlas_wb_migration_gates FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.atlas_wb_migration_gates TO authenticated;

-- Read-only inventory for staging dry-runs (owner-scoped).
CREATE OR REPLACE FUNCTION public.atlas_wb_migration_inventory(
  p_world_profile_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_owner UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT owner_user_id INTO v_owner FROM public.world_profiles WHERE id = p_world_profile_id;
  IF v_owner IS NULL OR v_owner <> v_user THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'world_profile_id', p_world_profile_id,
    'gate_enabled', COALESCE(
      (SELECT enabled FROM public.atlas_wb_migration_gates g WHERE g.world_profile_id = p_world_profile_id),
      false
    ),
    'place_counts', (
      SELECT COALESCE(jsonb_object_agg(kind, n), '{}'::jsonb)
      FROM (
        SELECT kind, count(*)::int AS n
        FROM public.world_places
        WHERE world_profile_id = p_world_profile_id
        GROUP BY kind
      ) s
    ),
    'orphan_settlements', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'public_id', public_id, 'name', name, 'kind', kind
      ) ORDER BY name), '[]'::jsonb)
      FROM public.world_places
      WHERE world_profile_id = p_world_profile_id
        AND parent_place_id IS NULL
        AND kind = 'settlement'
        AND status IS DISTINCT FROM 'archived'
    ),
    'review_kinds', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'public_id', public_id, 'name', name, 'kind', kind
      ) ORDER BY kind, name), '[]'::jsonb)
      FROM public.world_places
      WHERE world_profile_id = p_world_profile_id
        AND kind IN ('region', 'district', 'site', 'interior', 'dungeon')
        AND status IS DISTINCT FROM 'archived'
    ),
    'map_counts', (
      SELECT COALESCE(jsonb_object_agg(kind, n), '{}'::jsonb)
      FROM (
        SELECT kind, count(*)::int AS n
        FROM public.world_atlas_maps
        WHERE world_profile_id = p_world_profile_id
        GROUP BY kind
      ) s
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.atlas_wb_migration_inventory(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atlas_wb_migration_inventory(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

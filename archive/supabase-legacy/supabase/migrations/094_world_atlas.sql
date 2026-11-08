-- #702 — Hierarchical world atlas maps (Leaflet/Geoman) + Storage for basemap/Azgaar .map.
-- Preserves legacy world_maps tiles via kind=legacy_tiles root rows.

INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) VALUES (
  'world-atlas',
  'world-atlas',
  false,
  52428800,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'application/json',
    'application/octet-stream',
    'application/zip'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can upload world atlas assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can read world atlas assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update world atlas assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete world atlas assets" ON storage.objects;

CREATE POLICY "Users can upload world atlas assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'world-atlas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read world atlas assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'world-atlas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update world atlas assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'world-atlas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'world-atlas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete world atlas assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'world-atlas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE TABLE IF NOT EXISTS public.world_atlas_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_profile_id UUID NOT NULL REFERENCES public.world_profiles(id) ON DELETE CASCADE,
  parent_map_id UUID REFERENCES public.world_atlas_maps(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'world'
    CHECK (kind IN ('world', 'region', 'settlement', 'scene', 'legacy_tiles')),
  title TEXT NOT NULL DEFAULT 'Weltkarte',
  sort_order INT NOT NULL DEFAULT 0,
  bounds JSONB NOT NULL DEFAULT '{"minX":0,"minY":0,"maxX":1000,"maxY":1000}'::jsonb,
  layers JSONB NOT NULL DEFAULT '{"type":"FeatureCollection","features":[]}'::jsonb,
  basemap_storage_path TEXT,
  azgaar_map_storage_path TEXT,
  generator_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  revision BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT world_atlas_maps_parent_same_world CHECK (
    parent_map_id IS NULL OR parent_map_id <> id
  )
);

CREATE INDEX IF NOT EXISTS world_atlas_maps_world_idx
  ON public.world_atlas_maps (world_profile_id, sort_order, title);

CREATE INDEX IF NOT EXISTS world_atlas_maps_parent_idx
  ON public.world_atlas_maps (parent_map_id);

ALTER TABLE public.world_atlas_maps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "world_atlas_maps_select" ON public.world_atlas_maps;
DROP POLICY IF EXISTS "world_atlas_maps_insert" ON public.world_atlas_maps;
DROP POLICY IF EXISTS "world_atlas_maps_update" ON public.world_atlas_maps;
DROP POLICY IF EXISTS "world_atlas_maps_delete" ON public.world_atlas_maps;

CREATE POLICY "world_atlas_maps_select" ON public.world_atlas_maps
  FOR SELECT TO authenticated
  USING (public.current_user_can_read_world_profile(world_profile_id));

CREATE POLICY "world_atlas_maps_insert" ON public.world_atlas_maps
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_world_profile(world_profile_id));

CREATE POLICY "world_atlas_maps_update" ON public.world_atlas_maps
  FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_world_profile(world_profile_id))
  WITH CHECK (public.current_user_can_edit_world_profile(world_profile_id));

CREATE POLICY "world_atlas_maps_delete" ON public.world_atlas_maps
  FOR DELETE TO authenticated
  USING (public.current_user_can_edit_world_profile(world_profile_id));

-- Backfill: one legacy_tiles root per existing world_maps row.
INSERT INTO public.world_atlas_maps (
  world_profile_id, parent_map_id, kind, title, sort_order, generator_meta
)
SELECT
  wm.world_profile_id,
  NULL,
  'legacy_tiles',
  'Kachelkarte (Legacy)',
  0,
  jsonb_build_object('engine', 'legacy_tiles', 'migratedFrom', 'world_maps')
FROM public.world_maps wm
WHERE NOT EXISTS (
  SELECT 1 FROM public.world_atlas_maps m
  WHERE m.world_profile_id = wm.world_profile_id AND m.kind = 'legacy_tiles'
);

CREATE OR REPLACE FUNCTION public.list_world_atlas_maps(p_world_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_rows JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_world_profile_id IS NULL THEN
    RAISE EXCEPTION 'world_profile_id required' USING ERRCODE = '22023';
  END IF;
  IF NOT public.current_user_can_read_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'worldProfileId', m.world_profile_id,
      'parentMapId', m.parent_map_id,
      'kind', m.kind,
      'title', m.title,
      'sortOrder', m.sort_order,
      'revision', m.revision,
      'updatedAt', m.updated_at,
      'hasAzgaarMap', m.azgaar_map_storage_path IS NOT NULL,
      'hasBasemap', m.basemap_storage_path IS NOT NULL
    )
    ORDER BY m.sort_order, m.title
  ), '[]'::jsonb)
  INTO v_rows
  FROM public.world_atlas_maps m
  WHERE m.world_profile_id = p_world_profile_id;

  RETURN jsonb_build_object('maps', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_world_atlas_map(
  p_map_id UUID,
  p_player_view BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_row public.world_atlas_maps%ROWTYPE;
  v_layers JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_map_id IS NULL THEN
    RAISE EXCEPTION 'map_id required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM public.world_atlas_maps WHERE id = p_map_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.current_user_can_read_world_profile(v_row.world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_layers := COALESCE(v_row.layers, '{"type":"FeatureCollection","features":[]}'::jsonb);

  -- Player view: strip secret features (properties.secret / properties.discovered=false).
  IF p_player_view THEN
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(jsonb_agg(f.feat), '[]'::jsonb)
    )
    INTO v_layers
    FROM jsonb_array_elements(COALESCE(v_layers->'features', '[]'::jsonb)) AS f(feat)
    WHERE COALESCE((f.feat->'properties'->>'secret')::boolean, false) IS NOT TRUE
      AND (
        (f.feat->'properties'->>'discovered') IS NULL
        OR COALESCE((f.feat->'properties'->>'discovered')::boolean, true) IS TRUE
      );
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'worldProfileId', v_row.world_profile_id,
    'parentMapId', v_row.parent_map_id,
    'kind', v_row.kind,
    'title', v_row.title,
    'sortOrder', v_row.sort_order,
    'bounds', v_row.bounds,
    'layers', v_layers,
    'basemapStoragePath', v_row.basemap_storage_path,
    'azgaarMapStoragePath', CASE
      WHEN p_player_view THEN NULL
      ELSE v_row.azgaar_map_storage_path
    END,
    'generatorMeta', COALESCE(v_row.generator_meta, '{}'::jsonb),
    'revision', v_row.revision,
    'updatedAt', v_row.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_world_atlas_map(
  p_world_profile_id UUID,
  p_map_id UUID,
  p_parent_map_id UUID,
  p_kind TEXT,
  p_title TEXT,
  p_sort_order INT,
  p_bounds JSONB,
  p_layers JSONB,
  p_basemap_storage_path TEXT,
  p_azgaar_map_storage_path TEXT,
  p_generator_meta JSONB,
  p_expected_revision BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_id UUID;
  v_rev BIGINT;
  v_kind TEXT := COALESCE(NULLIF(trim(p_kind), ''), 'world');
  v_title TEXT := COALESCE(NULLIF(trim(p_title), ''), 'Weltkarte');
  v_layers JSONB := COALESCE(p_layers, '{"type":"FeatureCollection","features":[]}'::jsonb);
  v_bounds JSONB := COALESCE(p_bounds, '{"minX":0,"minY":0,"maxX":1000,"maxY":1000}'::jsonb);
  v_meta JSONB := COALESCE(p_generator_meta, '{}'::jsonb);
  v_layer_bytes INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_world_profile_id IS NULL THEN
    RAISE EXCEPTION 'world_profile_id required' USING ERRCODE = '22023';
  END IF;
  IF NOT public.current_user_can_edit_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_kind NOT IN ('world', 'region', 'settlement', 'scene', 'legacy_tiles') THEN
    RAISE EXCEPTION 'invalid kind' USING ERRCODE = '22023';
  END IF;

  v_layer_bytes := octet_length(v_layers::text);
  IF v_layer_bytes > 1500000 THEN
    RAISE EXCEPTION 'layers too large' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(jsonb_typeof(v_layers), '') <> 'object'
     OR COALESCE(v_layers->>'type', '') <> 'FeatureCollection' THEN
    RAISE EXCEPTION 'layers must be a GeoJSON FeatureCollection' USING ERRCODE = '22023';
  END IF;

  IF p_parent_map_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.world_atlas_maps p
      WHERE p.id = p_parent_map_id AND p.world_profile_id = p_world_profile_id
    ) THEN
      RAISE EXCEPTION 'parent map not in world' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_map_id IS NULL THEN
    INSERT INTO public.world_atlas_maps (
      world_profile_id, parent_map_id, kind, title, sort_order,
      bounds, layers, basemap_storage_path, azgaar_map_storage_path, generator_meta, revision
    ) VALUES (
      p_world_profile_id, p_parent_map_id, v_kind, v_title, COALESCE(p_sort_order, 0),
      v_bounds, v_layers, p_basemap_storage_path, p_azgaar_map_storage_path, v_meta, 1
    )
    RETURNING id, revision INTO v_id, v_rev;
  ELSE
    UPDATE public.world_atlas_maps m
    SET
      parent_map_id = p_parent_map_id,
      kind = v_kind,
      title = v_title,
      sort_order = COALESCE(p_sort_order, m.sort_order),
      bounds = v_bounds,
      layers = v_layers,
      basemap_storage_path = COALESCE(p_basemap_storage_path, m.basemap_storage_path),
      azgaar_map_storage_path = COALESCE(p_azgaar_map_storage_path, m.azgaar_map_storage_path),
      generator_meta = v_meta,
      revision = m.revision + 1,
      updated_at = now()
    WHERE m.id = p_map_id
      AND m.world_profile_id = p_world_profile_id
      AND m.revision = COALESCE(p_expected_revision, m.revision)
    RETURNING id, revision INTO v_id, v_rev;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'revision conflict or map not found' USING ERRCODE = '40001';
    END IF;
  END IF;

  RETURN public.get_world_atlas_map(v_id, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_world_atlas_root(p_world_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_can_edit_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_id
  FROM public.world_atlas_maps
  WHERE world_profile_id = p_world_profile_id
    AND parent_map_id IS NULL
  ORDER BY CASE WHEN kind = 'legacy_tiles' THEN 0 ELSE 1 END, sort_order
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.world_atlas_maps (
      world_profile_id, kind, title, generator_meta
    ) VALUES (
      p_world_profile_id,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.world_maps w WHERE w.world_profile_id = p_world_profile_id
      ) THEN 'legacy_tiles' ELSE 'world' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.world_maps w WHERE w.world_profile_id = p_world_profile_id
      ) THEN 'Kachelkarte (Legacy)' ELSE 'Weltkarte' END,
      jsonb_build_object(
        'engine',
        CASE WHEN EXISTS (
          SELECT 1 FROM public.world_maps w WHERE w.world_profile_id = p_world_profile_id
        ) THEN 'legacy_tiles' ELSE 'manual' END
      )
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN public.list_world_atlas_maps(p_world_profile_id);
END;
$$;

REVOKE ALL ON FUNCTION public.list_world_atlas_maps(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_world_atlas_map(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_world_atlas_map(UUID, UUID, UUID, TEXT, TEXT, INT, JSONB, JSONB, TEXT, TEXT, JSONB, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_world_atlas_root(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_world_atlas_maps(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_world_atlas_map(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_world_atlas_map(UUID, UUID, UUID, TEXT, TEXT, INT, JSONB, JSONB, TEXT, TEXT, JSONB, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_world_atlas_root(UUID) TO authenticated;

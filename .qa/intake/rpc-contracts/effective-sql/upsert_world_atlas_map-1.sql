-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.upsert_world_atlas_map(p_world_profile_id uuid, p_map_id uuid, p_parent_map_id uuid, p_kind text, p_title text, p_sort_order integer, p_bounds jsonb, p_layers jsonb, p_basemap_storage_path text, p_azgaar_map_storage_path text, p_generator_meta jsonb, p_expected_revision bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

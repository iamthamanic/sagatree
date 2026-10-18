-- Force atlas map redaction for non-editors (parity with list_world_places
-- v_party_only). Direct PostgREST SELECT on world_atlas_maps must not leak
-- generator_meta / layers; non-editors use get_world_atlas_map RPC.

DROP POLICY IF EXISTS "world_atlas_maps_select" ON public.world_atlas_maps;
CREATE POLICY "world_atlas_maps_select" ON public.world_atlas_maps
  FOR SELECT TO authenticated
  USING (public.current_user_can_edit_world_profile(world_profile_id));

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
  v_meta JSONB;
  v_can_edit BOOLEAN;
  v_party_only BOOLEAN;
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

  v_can_edit := public.current_user_can_edit_world_profile(v_row.world_profile_id);
  -- Non-editors always get redacted geometry; editors only when player_view.
  v_party_only := (NOT v_can_edit) OR (p_player_view IS TRUE);

  v_layers := COALESCE(v_row.layers, '{"type":"FeatureCollection","features":[]}'::jsonb);
  v_meta := COALESCE(v_row.generator_meta, '{}'::jsonb);

  IF v_party_only THEN
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

    v_meta := jsonb_build_object(
      'engine', COALESCE(v_meta->>'engine', 'unified_canvas')
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
      WHEN v_party_only THEN NULL
      ELSE v_row.azgaar_map_storage_path
    END,
    'generatorMeta', v_meta,
    'revision', v_row.revision,
    'updatedAt', v_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_world_atlas_map(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_world_atlas_map(UUID, BOOLEAN) TO authenticated;

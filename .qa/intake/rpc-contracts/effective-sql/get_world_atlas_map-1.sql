-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.get_world_atlas_map(p_map_id uuid, p_player_view boolean = FALSE, p_saga_public_id text = NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_row public.world_atlas_maps%ROWTYPE;
  v_layers JSONB;
  v_meta JSONB;
  v_can_edit BOOLEAN;
  v_party_only BOOLEAN;
  v_project UUID;
  v_allowed UUID[];
  v_parent UUID;
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
  v_party_only := (NOT v_can_edit) OR (p_player_view IS TRUE);

  IF v_party_only THEN
    IF p_saga_public_id IS NOT NULL AND btrim(p_saga_public_id) <> '' THEN
      v_project := public.atlas_wb_resolve_saga_project(v_row.world_profile_id, p_saga_public_id);
    END IF;
    IF v_project IS NULL THEN
      RAISE EXCEPTION 'not found' USING ERRCODE = 'P0002';
    END IF;
    v_allowed := public.atlas_wb_party_revealed_map_ids(v_row.world_profile_id, v_project);
    IF NOT (p_map_id = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  v_layers := COALESCE(v_row.layers, '{"type":"FeatureCollection","features":[]}'::jsonb);
  v_meta := COALESCE(v_row.generator_meta, '{}'::jsonb);
  v_parent := v_row.parent_map_id;

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

    IF v_parent IS NOT NULL AND NOT (v_parent = ANY (v_allowed)) THEN
      v_parent := NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'worldProfileId', v_row.world_profile_id,
    'parentMapId', v_parent,
    'kind', v_row.kind,
    'title', v_row.title,
    'sortOrder', v_row.sort_order,
    'bounds', v_row.bounds,
    'layers', v_layers,
    'basemapStoragePath', CASE
      WHEN v_party_only THEN v_row.basemap_storage_path
      ELSE v_row.basemap_storage_path
    END,
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

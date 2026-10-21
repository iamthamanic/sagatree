-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.delete_world_node(p_world_profile_id uuid, p_place_id uuid, p_confirm boolean = FALSE) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_preview JSONB;
  v_ids UUID[];
  v_maps UUID[];
  v_n INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_can_edit_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_preview := public.preview_world_node_consequences(p_world_profile_id, p_place_id);
  IF (v_preview->>'requiresConfirm')::BOOLEAN IS TRUE AND p_confirm IS NOT TRUE THEN
    RAISE EXCEPTION 'confirmation required' USING ERRCODE = '22023';
  END IF;

  v_ids := public.atlas_wb_descendant_ids(p_world_profile_id, p_place_id);
  v_ids := array_append(v_ids, p_place_id);

  SELECT COALESCE(array_agg(map_id), ARRAY[]::UUID[]) INTO v_maps
  FROM public.world_place_map_links
  WHERE world_profile_id = p_world_profile_id AND place_id = ANY (v_ids);

  -- Detach saga bindings (keep saga rows; clear place FK)
  UPDATE public.saga_asset_bindings
  SET world_place_id = NULL, updated_at = NOW()
  WHERE world_place_id = ANY (v_ids);

  DELETE FROM public.world_place_map_links
  WHERE world_profile_id = p_world_profile_id AND place_id = ANY (v_ids);

  DELETE FROM public.world_places
  WHERE world_profile_id = p_world_profile_id AND id = ANY (v_ids);

  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF cardinality(v_maps) > 0 THEN
    DELETE FROM public.world_atlas_maps
    WHERE world_profile_id = p_world_profile_id
      AND id = ANY (v_maps)
      AND kind <> 'world';
  END IF;

  RETURN jsonb_build_object(
    'deletedCount', v_n,
    'placeIds', to_jsonb(v_ids),
    'consequences', v_preview
  );
END;
$$;

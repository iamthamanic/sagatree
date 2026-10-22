-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.preview_world_node_consequences(p_world_profile_id uuid, p_place_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_desc UUID[];
  v_child INT;
  v_bind INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_can_edit_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  PERFORM public.atlas_wb_place_row(p_world_profile_id, p_place_id);

  v_desc := public.atlas_wb_descendant_ids(p_world_profile_id, p_place_id);
  v_child := COALESCE(cardinality(v_desc), 0);

  SELECT COUNT(*)::INT INTO v_bind
  FROM public.saga_asset_bindings b
  WHERE b.world_place_id = p_place_id
     OR b.world_place_id = ANY (v_desc);

  RETURN jsonb_build_object(
    'placeId', p_place_id,
    'childCount', v_child,
    'sagaBindingCount', v_bind,
    'requiresConfirm', (v_child > 0 OR v_bind > 0),
    'descendantIds', to_jsonb(v_desc)
  );
END;
$$;

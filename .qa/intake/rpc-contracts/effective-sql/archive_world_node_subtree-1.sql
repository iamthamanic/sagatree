-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.archive_world_node_subtree(p_world_profile_id uuid, p_place_id uuid, p_confirm boolean = FALSE) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_preview JSONB;
  v_ids UUID[];
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

  UPDATE public.world_places
  SET status = 'archived', revision = revision + 1, updated_at = NOW()
  WHERE world_profile_id = p_world_profile_id AND id = ANY (v_ids);

  GET DIAGNOSTICS v_n = ROW_COUNT;

  RETURN jsonb_build_object(
    'archivedCount', v_n,
    'placeIds', to_jsonb(v_ids),
    'consequences', v_preview
  );
END;
$$;

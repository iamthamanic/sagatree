-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.reparent_world_node(p_world_profile_id uuid, p_place_id uuid, p_new_parent_place_id uuid, p_confirm_relocate boolean = FALSE) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_row public.world_places%ROWTYPE;
  v_parent public.world_places%ROWTYPE;
  v_parent_kind TEXT;
  v_need TEXT;
  v_desc UUID[];
  v_map UUID;
  v_parent_map UUID;
  v_root_map UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_can_edit_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_confirm_relocate IS NOT TRUE THEN
    RAISE EXCEPTION 'relocate confirmation required' USING ERRCODE = '22023';
  END IF;

  v_row := public.atlas_wb_place_row(p_world_profile_id, p_place_id);
  IF NOT public.atlas_wb_is_canonical_kind(v_row.kind) THEN
    RAISE EXCEPTION 'kind must be canonical WorldNodeKind' USING ERRCODE = '22023';
  END IF;

  IF p_new_parent_place_id IS NOT NULL THEN
    IF p_new_parent_place_id = p_place_id THEN
      RAISE EXCEPTION 'cycle' USING ERRCODE = '23514';
    END IF;
    v_desc := public.atlas_wb_descendant_ids(p_world_profile_id, p_place_id);
    IF p_new_parent_place_id = ANY (v_desc) THEN
      RAISE EXCEPTION 'cycle' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO v_parent
    FROM public.world_places
    WHERE id = p_new_parent_place_id AND world_profile_id = p_world_profile_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'parent not in world' USING ERRCODE = '23514';
    END IF;
    v_parent_kind := v_parent.kind;
  ELSE
    v_parent_kind := NULL;
  END IF;

  v_need := public.atlas_wb_required_parent_kind(v_row.kind);
  IF NOT public.atlas_wb_tip_satisfies(v_need, v_parent_kind) THEN
    RAISE EXCEPTION 'invalid parent kind edge' USING ERRCODE = '23514';
  END IF;

  v_root_map := public.atlas_wb_ensure_world_root_map(p_world_profile_id);
  IF p_new_parent_place_id IS NOT NULL THEN
    v_parent_map := public.atlas_wb_primary_map_id(p_new_parent_place_id);
  END IF;
  IF v_parent_map IS NULL THEN
    v_parent_map := v_root_map;
  END IF;

  UPDATE public.world_places
  SET
    parent_place_id = p_new_parent_place_id,
    revision = revision + 1,
    updated_at = NOW()
  WHERE id = p_place_id AND world_profile_id = p_world_profile_id
  RETURNING * INTO v_row;

  v_map := public.atlas_wb_primary_map_id(p_place_id);
  IF v_map IS NOT NULL THEN
    UPDATE public.world_atlas_maps
    SET
      parent_map_id = v_parent_map,
      generator_meta = COALESCE(generator_meta, '{}'::jsonb)
        || jsonb_build_object('mapStatus', 'unlocated'),
      updated_at = NOW()
    WHERE id = v_map AND world_profile_id = p_world_profile_id;
  END IF;

  RETURN jsonb_build_object(
    'place', public.atlas_wb_place_json(v_row),
    'primaryMapId', v_map,
    'parentMapId', v_parent_map,
    'relocated', true
  );
END;
$$;

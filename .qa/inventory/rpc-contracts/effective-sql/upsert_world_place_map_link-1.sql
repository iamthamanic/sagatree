-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.upsert_world_place_map_link(p_world_profile_id uuid, p_place_id uuid, p_map_id uuid, p_usage text, p_feature_id text = NULL, p_anchor jsonb = CAST('{}' AS jsonb)) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_row public.world_place_map_links%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_can_edit_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_place_id IS NULL OR p_map_id IS NULL OR p_usage IS NULL OR btrim(p_usage) = '' THEN
    RAISE EXCEPTION 'place, map and usage required' USING ERRCODE = '22023';
  END IF;

  -- Same-world: place and map must belong to the world profile.
  IF NOT EXISTS (
    SELECT 1 FROM public.world_places p
    WHERE p.id = p_place_id AND p.world_profile_id = p_world_profile_id
  ) THEN
    RAISE EXCEPTION 'place not in world' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.world_atlas_maps m
    WHERE m.id = p_map_id AND m.world_profile_id = p_world_profile_id
  ) THEN
    RAISE EXCEPTION 'map not in world' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.world_place_map_links (
    world_profile_id, place_id, map_id, usage, feature_id, anchor
  ) VALUES (
    p_world_profile_id,
    p_place_id,
    p_map_id,
    btrim(p_usage),
    NULLIF(btrim(COALESCE(p_feature_id, '')), ''),
    COALESCE(p_anchor, '{}'::jsonb)
  )
  ON CONFLICT (place_id, map_id, usage) DO UPDATE
    SET feature_id = EXCLUDED.feature_id,
        anchor = EXCLUDED.anchor
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'worldProfileId', v_row.world_profile_id,
    'placeId', v_row.place_id,
    'mapId', v_row.map_id,
    'usage', v_row.usage,
    'featureId', v_row.feature_id,
    'anchor', v_row.anchor
  );
END;
$$;

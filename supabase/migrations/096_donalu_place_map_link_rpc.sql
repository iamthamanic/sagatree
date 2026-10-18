-- #donalu-world-workspace — upsert place↔map link + expose world_place_id on saga bindings.

CREATE OR REPLACE FUNCTION public.upsert_world_place_map_link(
  p_world_profile_id UUID,
  p_place_id UUID,
  p_map_id UUID,
  p_usage TEXT,
  p_feature_id TEXT DEFAULT NULL,
  p_anchor JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

REVOKE ALL ON FUNCTION public.upsert_world_place_map_link(UUID, UUID, UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_world_place_map_link(UUID, UUID, UUID, TEXT, TEXT, JSONB) TO authenticated;

-- Expose world_place_id on saga binding list (player-safe via existing can_view filter).
CREATE OR REPLACE FUNCTION public.list_saga_bindings(
  p_public_id TEXT,
  p_asset_kind TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_id UUID;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT id INTO v_project_id
  FROM public.projects
  WHERE public_id = UPPER(BTRIM(p_public_id));

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'saga not found';
  END IF;

  IF NOT public.current_user_is_active_project_member(v_project_id)
     AND NOT public.is_project_gm(v_project_id, v_uid) THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'assetKind', b.asset_kind,
        'assetId', b.asset_id,
        'reveal', b.reveal,
        'label', b.label,
        'metadata', b.metadata,
        'worldPlaceId', b.world_place_id
      )
      ORDER BY b.asset_kind, b.label, b.asset_id
    )
    FROM public.saga_asset_bindings b
    WHERE b.project_id = v_project_id
      AND (p_asset_kind IS NULL OR b.asset_kind = p_asset_kind)
      AND public.can_view_saga_binding(b.project_id, b.reveal, b.asset_kind)
      AND b.reveal <> 'unlisted'
  ), '[]'::jsonb);
END;
$$;

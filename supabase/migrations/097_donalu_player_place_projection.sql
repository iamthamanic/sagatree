-- #donalu-world-workspace — player-safe place/map-link projection + atlas meta redaction.

CREATE OR REPLACE FUNCTION public.list_world_places(
  p_world_profile_id UUID,
  p_player_view BOOLEAN DEFAULT false,
  p_saga_public_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_project UUID;
  v_rows JSONB;
  v_can_edit BOOLEAN;
  v_party_only BOOLEAN;
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

  v_can_edit := public.current_user_can_edit_world_profile(p_world_profile_id);
  -- Non-editors always get party-filtered projection; editors only when player_view.
  v_party_only := (NOT v_can_edit) OR (p_player_view IS TRUE);

  IF p_saga_public_id IS NOT NULL AND btrim(p_saga_public_id) <> '' THEN
    SELECT id INTO v_project
    FROM public.projects
    WHERE public_id = upper(btrim(p_saga_public_id))
      AND world_profile_id = p_world_profile_id;
  END IF;

  IF v_party_only THEN
    IF v_project IS NULL THEN
      -- Fail closed: never dump full catalog for player / non-editor without saga.
      RETURN jsonb_build_object('places', '[]'::jsonb);
    END IF;

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'worldProfileId', p.world_profile_id,
        'parentPlaceId', p.parent_place_id,
        'kind', p.kind,
        'name', p.name,
        'description', p.description,
        'status', p.status,
        'seedKey', p.seed_key,
        'sortOrder', p.sort_order,
        'revision', p.revision,
        'bindingReveal', b.reveal,
        'bindingAssetId', b.asset_id
      )
      ORDER BY p.sort_order, p.name
    ), '[]'::jsonb)
    INTO v_rows
    FROM public.world_places p
    INNER JOIN public.saga_asset_bindings b
      ON b.world_place_id = p.id
     AND b.project_id = v_project
     AND b.asset_kind = 'location'
     AND b.reveal = 'party'
    WHERE p.world_profile_id = p_world_profile_id
      AND p.status <> 'archived';
  ELSE
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'worldProfileId', p.world_profile_id,
        'parentPlaceId', p.parent_place_id,
        'kind', p.kind,
        'name', p.name,
        'description', p.description,
        'status', p.status,
        'seedKey', p.seed_key,
        'sortOrder', p.sort_order,
        'revision', p.revision
      )
      ORDER BY p.sort_order, p.name
    ), '[]'::jsonb)
    INTO v_rows
    FROM public.world_places p
    WHERE p.world_profile_id = p_world_profile_id
      AND p.status <> 'archived';
  END IF;

  RETURN jsonb_build_object('places', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.list_world_place_map_links(
  p_world_profile_id UUID,
  p_player_view BOOLEAN DEFAULT false,
  p_saga_public_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_project UUID;
  v_rows JSONB;
  v_can_edit BOOLEAN;
  v_party_only BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_can_read_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_can_edit := public.current_user_can_edit_world_profile(p_world_profile_id);
  v_party_only := (NOT v_can_edit) OR (p_player_view IS TRUE);

  IF p_saga_public_id IS NOT NULL AND btrim(p_saga_public_id) <> '' THEN
    SELECT id INTO v_project
    FROM public.projects
    WHERE public_id = upper(btrim(p_saga_public_id))
      AND world_profile_id = p_world_profile_id;
  END IF;

  IF v_party_only THEN
    IF v_project IS NULL THEN
      RETURN jsonb_build_object('links', '[]'::jsonb);
    END IF;

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'worldProfileId', l.world_profile_id,
        'placeId', l.place_id,
        'mapId', l.map_id,
        'usage', l.usage,
        'featureId', l.feature_id,
        'anchor', l.anchor
      )
      ORDER BY l.usage, l.created_at
    ), '[]'::jsonb)
    INTO v_rows
    FROM public.world_place_map_links l
    INNER JOIN public.saga_asset_bindings b
      ON b.world_place_id = l.place_id
     AND b.project_id = v_project
     AND b.asset_kind = 'location'
     AND b.reveal = 'party'
    WHERE l.world_profile_id = p_world_profile_id;
  ELSE
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'worldProfileId', l.world_profile_id,
        'placeId', l.place_id,
        'mapId', l.map_id,
        'usage', l.usage,
        'featureId', l.feature_id,
        'anchor', l.anchor
      )
      ORDER BY l.usage, l.created_at
    ), '[]'::jsonb)
    INTO v_rows
    FROM public.world_place_map_links l
    WHERE l.world_profile_id = p_world_profile_id;
  END IF;

  RETURN jsonb_build_object('links', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

-- Drop old 1-arg signature if present so callers use the filtered overload.
DROP FUNCTION IF EXISTS public.list_world_place_map_links(UUID);

REVOKE ALL ON FUNCTION public.list_world_places(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_world_place_map_links(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_world_places(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_world_place_map_links(UUID, BOOLEAN, TEXT) TO authenticated;

-- Player view: redact canvas/dungeon geometry from generator_meta.
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
  v_meta := COALESCE(v_row.generator_meta, '{}'::jsonb);

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
      WHEN p_player_view THEN NULL
      ELSE v_row.azgaar_map_storage_path
    END,
    'generatorMeta', v_meta,
    'revision', v_row.revision,
    'updatedAt', v_row.updated_at
  );
END;
$$;

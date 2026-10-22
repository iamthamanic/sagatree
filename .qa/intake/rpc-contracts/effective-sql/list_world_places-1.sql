-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.list_world_places(p_world_profile_id uuid, p_player_view boolean = FALSE, p_saga_public_id text = NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

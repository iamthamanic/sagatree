-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.list_world_place_map_links(p_world_profile_id uuid, p_player_view boolean = FALSE, p_saga_public_id text = NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

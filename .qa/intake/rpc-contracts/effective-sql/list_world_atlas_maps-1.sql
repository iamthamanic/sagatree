-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.list_world_atlas_maps(p_world_profile_id uuid, p_player_view boolean = FALSE, p_saga_public_id text = NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_rows JSONB;
  v_can_edit BOOLEAN;
  v_party_only BOOLEAN;
  v_project UUID;
  v_allowed UUID[];
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
  v_party_only := (NOT v_can_edit) OR (p_player_view IS TRUE);

  IF p_saga_public_id IS NOT NULL AND btrim(p_saga_public_id) <> '' THEN
    v_project := public.atlas_wb_resolve_saga_project(p_world_profile_id, p_saga_public_id);
  END IF;

  IF v_party_only THEN
    IF v_project IS NULL THEN
      -- Fail closed: never dump full atlas catalog without saga.
      RETURN jsonb_build_object('maps', '[]'::jsonb);
    END IF;
    v_allowed := public.atlas_wb_party_revealed_map_ids(p_world_profile_id, v_project);

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'worldProfileId', m.world_profile_id,
        -- Hide parent id when parent map is not party-revealed (no breadcrumb leak).
        'parentMapId', CASE
          WHEN m.parent_map_id IS NULL THEN NULL
          WHEN m.parent_map_id = ANY (v_allowed) THEN m.parent_map_id
          ELSE NULL
        END,
        'kind', m.kind,
        'title', m.title,
        'sortOrder', m.sort_order,
        'revision', m.revision,
        'updatedAt', m.updated_at,
        'hasAzgaarMap', false,
        'hasBasemap', m.basemap_storage_path IS NOT NULL
      )
      ORDER BY m.sort_order, m.title
    ), '[]'::jsonb)
    INTO v_rows
    FROM public.world_atlas_maps m
    WHERE m.world_profile_id = p_world_profile_id
      AND m.id = ANY (v_allowed);
  ELSE
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'worldProfileId', m.world_profile_id,
        'parentMapId', m.parent_map_id,
        'kind', m.kind,
        'title', m.title,
        'sortOrder', m.sort_order,
        'revision', m.revision,
        'updatedAt', m.updated_at,
        'hasAzgaarMap', m.azgaar_map_storage_path IS NOT NULL,
        'hasBasemap', m.basemap_storage_path IS NOT NULL
      )
      ORDER BY m.sort_order, m.title
    ), '[]'::jsonb)
    INTO v_rows
    FROM public.world_atlas_maps m
    WHERE m.world_profile_id = p_world_profile_id;
  END IF;

  RETURN jsonb_build_object('maps', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

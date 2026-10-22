-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.upsert_world_place(p_world_profile_id uuid, p_place_id uuid, p_parent_place_id uuid, p_kind text, p_name text, p_description text, p_status text, p_seed_key text, p_sort_order integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_row public.world_places%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_can_edit_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_kind IS NULL OR p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'kind and name required' USING ERRCODE = '22023';
  END IF;

  IF p_place_id IS NULL THEN
    INSERT INTO public.world_places (
      world_profile_id, parent_place_id, kind, name, description, status, seed_key, sort_order
    ) VALUES (
      p_world_profile_id,
      p_parent_place_id,
      p_kind,
      btrim(p_name),
      NULLIF(btrim(COALESCE(p_description, '')), ''),
      COALESCE(NULLIF(p_status, ''), 'draft'),
      NULLIF(btrim(COALESCE(p_seed_key, '')), ''),
      COALESCE(p_sort_order, 0)
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.world_places
    SET
      parent_place_id = p_parent_place_id,
      kind = p_kind,
      name = btrim(p_name),
      description = NULLIF(btrim(COALESCE(p_description, '')), ''),
      status = COALESCE(NULLIF(p_status, ''), status),
      seed_key = COALESCE(NULLIF(btrim(COALESCE(p_seed_key, '')), ''), seed_key),
      sort_order = COALESCE(p_sort_order, sort_order),
      revision = revision + 1,
      updated_at = NOW()
    WHERE id = p_place_id AND world_profile_id = p_world_profile_id
    RETURNING * INTO v_row;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'worldProfileId', v_row.world_profile_id,
    'parentPlaceId', v_row.parent_place_id,
    'kind', v_row.kind,
    'name', v_row.name,
    'description', v_row.description,
    'status', v_row.status,
    'seedKey', v_row.seed_key,
    'sortOrder', v_row.sort_order,
    'revision', v_row.revision
  );
END;
$$;

-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.create_world_node_with_maps(p_world_profile_id uuid, p_kind text, p_name text, p_idempotency_key text, p_subtype text = NULL, p_parent_place_id uuid = NULL, p_description text = NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_key TEXT := NULLIF(btrim(p_idempotency_key), '');
  v_name TEXT := NULLIF(btrim(p_name), '');
  v_kind TEXT := NULLIF(btrim(p_kind), '');
  v_cached JSONB;
  v_root_map UUID;
  v_parent UUID := p_parent_place_id;
  v_parent_kind TEXT;
  v_parent_map UUID;
  v_need TEXT;
  v_chain TEXT[];
  v_k TEXT;
  v_place UUID;
  v_map UUID;
  v_created JSONB := '[]'::jsonb;
  v_status TEXT;
  v_ph_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_world_profile_id IS NULL OR v_kind IS NULL OR v_name IS NULL OR v_key IS NULL THEN
    RAISE EXCEPTION 'invalid input' USING ERRCODE = '22023';
  END IF;
  IF NOT public.atlas_wb_is_canonical_kind(v_kind) THEN
    RAISE EXCEPTION 'kind must be canonical WorldNodeKind' USING ERRCODE = '22023';
  END IF;
  IF NOT public.current_user_can_edit_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT result INTO v_cached
  FROM public.world_node_create_idempotency
  WHERE world_profile_id = p_world_profile_id
    AND idempotency_key = v_key;
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  -- Validate optional parent
  IF v_parent IS NOT NULL THEN
    SELECT kind INTO v_parent_kind
    FROM public.world_places
    WHERE id = v_parent AND world_profile_id = p_world_profile_id;
    IF v_parent_kind IS NULL THEN
      RAISE EXCEPTION 'parent not in world' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Missing ancestors (mirrors domains/world/hierarchy missingAncestorKinds):
  -- walk required parents upward; stop once tip rank covers the cursor.
  v_need := public.atlas_wb_required_parent_kind(v_kind);
  v_chain := ARRAY[]::TEXT[];
  WHILE v_need IS NOT NULL LOOP
    EXIT WHEN v_parent IS NOT NULL
      AND v_parent_kind IS NOT NULL
      AND public.atlas_wb_kind_rank(v_parent_kind) IS NOT NULL
      AND public.atlas_wb_kind_rank(v_need) <= public.atlas_wb_kind_rank(v_parent_kind);
    v_chain := array_prepend(v_need, v_chain);
    v_need := public.atlas_wb_required_parent_kind(v_need);
  END LOOP;

  -- Empty chain ⇒ tip must already be the valid immediate parent (legacy aliases OK).
  IF COALESCE(cardinality(v_chain), 0) = 0 THEN
    v_need := public.atlas_wb_required_parent_kind(v_kind);
    IF NOT public.atlas_wb_tip_satisfies(v_need, v_parent_kind) THEN
      RAISE EXCEPTION 'invalid parent kind edge' USING ERRCODE = '23514';
    END IF;
  ELSIF v_parent IS NOT NULL THEN
    -- Non-empty chain under a tip ⇒ tip must parent the highest missing ancestor.
    IF NOT public.atlas_wb_tip_satisfies(
      public.atlas_wb_required_parent_kind(v_chain[1]),
      v_parent_kind
    ) THEN
      RAISE EXCEPTION 'invalid parent kind edge' USING ERRCODE = '23514';
    END IF;
  END IF;

  v_root_map := public.atlas_wb_ensure_world_root_map(p_world_profile_id);

  -- Resolve parent map for first insert
  IF v_parent IS NOT NULL THEN
    SELECT map_id INTO v_parent_map
    FROM public.world_place_map_links
    WHERE place_id = v_parent AND usage = 'primary'
    LIMIT 1;
  END IF;
  IF v_parent_map IS NULL THEN
    v_parent_map := v_root_map;
  END IF;

  -- Create ancestors
  FOREACH v_k IN ARRAY v_chain LOOP
    v_ph_name := public.atlas_wb_next_placeholder_name(p_world_profile_id, v_parent, v_k);
    INSERT INTO public.world_places (
      world_profile_id, parent_place_id, kind, name, description, status, subtype, sort_order
    ) VALUES (
      p_world_profile_id, v_parent, v_k, v_ph_name, NULL, 'placeholder', NULL, 0
    )
    RETURNING id INTO v_place;

    v_map := public.atlas_wb_create_primary_map(
      p_world_profile_id, v_place, v_k, v_ph_name || ' (Karte)', v_parent_map
    );

    v_created := v_created || jsonb_build_array(jsonb_build_object(
      'placeId', v_place,
      'kind', v_k,
      'name', v_ph_name,
      'status', 'placeholder',
      'mapId', v_map,
      'role', 'ancestor_placeholder'
    ));

    v_parent := v_place;
    v_parent_kind := v_k;
    v_parent_map := v_map;
  END LOOP;

  -- Target node
  v_status := 'draft';
  INSERT INTO public.world_places (
    world_profile_id, parent_place_id, kind, name, description, status, subtype, sort_order
  ) VALUES (
    p_world_profile_id, v_parent, v_kind, v_name, p_description, v_status, NULLIF(btrim(p_subtype), ''), 0
  )
  RETURNING id INTO v_place;

  v_map := public.atlas_wb_create_primary_map(
    p_world_profile_id, v_place, v_kind, v_name || ' (Karte)', v_parent_map
  );

  v_created := v_created || jsonb_build_array(jsonb_build_object(
    'placeId', v_place,
    'kind', v_kind,
    'name', v_name,
    'status', v_status,
    'mapId', v_map,
    'role', 'target'
  ));

  v_cached := jsonb_build_object(
    'worldProfileId', p_world_profile_id,
    'worldRootMapId', v_root_map,
    'targetPlaceId', v_place,
    'targetMapId', v_map,
    'created', v_created,
    'idempotencyKey', v_key
  );

  INSERT INTO public.world_node_create_idempotency (world_profile_id, idempotency_key, result)
  VALUES (p_world_profile_id, v_key, v_cached);

  RETURN v_cached;
END;
$$;

-- #716 — Rename / reparent / duplicate / archive / delete world nodes (Epic #712).
-- Additive RPCs only. No mass delete of existing Dornhain/saga data.

CREATE OR REPLACE FUNCTION public.atlas_wb_place_row(p_world UUID, p_place UUID)
RETURNS public.world_places
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.world_places%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.world_places
  WHERE id = p_place AND world_profile_id = p_world;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not found' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_wb_descendant_ids(p_world UUID, p_root UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE d AS (
    SELECT id FROM public.world_places
    WHERE world_profile_id = p_world AND parent_place_id = p_root
    UNION ALL
    SELECT p.id FROM public.world_places p
    INNER JOIN d ON p.parent_place_id = d.id
    WHERE p.world_profile_id = p_world
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) FROM d;
$$;

CREATE OR REPLACE FUNCTION public.atlas_wb_primary_map_id(p_place UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT map_id FROM public.world_place_map_links
  WHERE place_id = p_place AND usage = 'primary'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.atlas_wb_place_json(p_row public.world_places)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'id', p_row.id,
    'worldProfileId', p_row.world_profile_id,
    'parentPlaceId', p_row.parent_place_id,
    'kind', p_row.kind,
    'name', p_row.name,
    'description', p_row.description,
    'status', p_row.status,
    'seedKey', p_row.seed_key,
    'sortOrder', p_row.sort_order,
    'revision', p_row.revision
  );
$$;

-- ---------------------------------------------------------------------------
-- Consequences preview
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preview_world_node_consequences(
  p_world_profile_id UUID,
  p_place_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_desc UUID[];
  v_child INT;
  v_bind INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_can_edit_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  PERFORM public.atlas_wb_place_row(p_world_profile_id, p_place_id);

  v_desc := public.atlas_wb_descendant_ids(p_world_profile_id, p_place_id);
  v_child := COALESCE(cardinality(v_desc), 0);

  SELECT COUNT(*)::INT INTO v_bind
  FROM public.saga_asset_bindings b
  WHERE b.world_place_id = p_place_id
     OR b.world_place_id = ANY (v_desc);

  RETURN jsonb_build_object(
    'placeId', p_place_id,
    'childCount', v_child,
    'sagaBindingCount', v_bind,
    'requiresConfirm', (v_child > 0 OR v_bind > 0),
    'descendantIds', to_jsonb(v_desc)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Rename
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rename_world_node(
  p_world_profile_id UUID,
  p_place_id UUID,
  p_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.world_places%ROWTYPE;
  v_name TEXT := NULLIF(btrim(p_name), '');
  v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_can_edit_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'empty name' USING ERRCODE = '22023';
  END IF;

  v_row := public.atlas_wb_place_row(p_world_profile_id, p_place_id);
  v_status := CASE WHEN v_row.status = 'placeholder' THEN 'draft' ELSE v_row.status END;

  UPDATE public.world_places
  SET
    name = v_name,
    status = v_status,
    revision = revision + 1,
    updated_at = NOW()
  WHERE id = p_place_id AND world_profile_id = p_world_profile_id
  RETURNING * INTO v_row;

  RETURN public.atlas_wb_place_json(v_row);
END;
$$;

-- ---------------------------------------------------------------------------
-- Reparent
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reparent_world_node(
  p_world_profile_id UUID,
  p_place_id UUID,
  p_new_parent_place_id UUID,
  p_confirm_relocate BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

-- ---------------------------------------------------------------------------
-- Duplicate (shallow default; deep opt-in copies subtree places + blank maps)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.duplicate_world_node(
  p_world_profile_id UUID,
  p_place_id UUID,
  p_deep BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src public.world_places%ROWTYPE;
  v_new UUID;
  v_map UUID;
  v_parent_map UUID;
  v_root_map UUID;
  v_created JSONB := '[]'::jsonb;
  v_new_parent UUID;
  v_new_child UUID;
  v_map_new UUID;
  r RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_can_edit_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_src := public.atlas_wb_place_row(p_world_profile_id, p_place_id);
  v_root_map := public.atlas_wb_ensure_world_root_map(p_world_profile_id);

  IF v_src.parent_place_id IS NOT NULL THEN
    v_parent_map := public.atlas_wb_primary_map_id(v_src.parent_place_id);
  END IF;
  IF v_parent_map IS NULL THEN
    v_parent_map := v_root_map;
  END IF;

  INSERT INTO public.world_places (
    world_profile_id, parent_place_id, kind, name, description, status, subtype, sort_order
  ) VALUES (
    p_world_profile_id,
    v_src.parent_place_id,
    v_src.kind,
    v_src.name || ' (Kopie)',
    v_src.description,
    'draft',
    v_src.subtype,
    v_src.sort_order
  )
  RETURNING id INTO v_new;

  v_map := public.atlas_wb_create_primary_map(
    p_world_profile_id, v_new, v_src.kind, v_src.name || ' (Kopie) (Karte)', v_parent_map
  );

  v_created := v_created || jsonb_build_array(jsonb_build_object(
    'placeId', v_new, 'mapId', v_map, 'sourcePlaceId', p_place_id, 'role', 'root'
  ));

  IF p_deep IS TRUE THEN
    CREATE TEMP TABLE IF NOT EXISTS atlas_wb_dup_map (
      old_id UUID PRIMARY KEY,
      new_id UUID NOT NULL
    ) ON COMMIT DROP;
    DELETE FROM atlas_wb_dup_map;
    INSERT INTO atlas_wb_dup_map(old_id, new_id) VALUES (p_place_id, v_new);

    FOR r IN
      WITH RECURSIVE tree AS (
        SELECT id, parent_place_id, kind, name, description, subtype, sort_order, 1 AS depth
        FROM public.world_places
        WHERE world_profile_id = p_world_profile_id AND parent_place_id = p_place_id
        UNION ALL
        SELECT p.id, p.parent_place_id, p.kind, p.name, p.description, p.subtype, p.sort_order, t.depth + 1
        FROM public.world_places p
        INNER JOIN tree t ON p.parent_place_id = t.id
        WHERE p.world_profile_id = p_world_profile_id
      )
      SELECT * FROM tree ORDER BY depth ASC
    LOOP
      SELECT new_id INTO v_new_parent FROM atlas_wb_dup_map WHERE old_id = r.parent_place_id;
      INSERT INTO public.world_places (
        world_profile_id, parent_place_id, kind, name, description, status, subtype, sort_order
      ) VALUES (
        p_world_profile_id, v_new_parent, r.kind, r.name, r.description, 'draft', r.subtype, r.sort_order
      )
      RETURNING id INTO v_new_child;

      v_parent_map := public.atlas_wb_primary_map_id(v_new_parent);
      IF v_parent_map IS NULL THEN
        v_parent_map := v_root_map;
      END IF;
      v_map_new := public.atlas_wb_create_primary_map(
        p_world_profile_id, v_new_child, r.kind, r.name || ' (Karte)', v_parent_map
      );
      INSERT INTO atlas_wb_dup_map(old_id, new_id) VALUES (r.id, v_new_child);
      v_created := v_created || jsonb_build_array(jsonb_build_object(
        'placeId', v_new_child, 'mapId', v_map_new, 'sourcePlaceId', r.id, 'role', 'deep_copy'
      ));
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'rootPlaceId', v_new,
    'rootMapId', v_map,
    'deep', COALESCE(p_deep, FALSE),
    'created', v_created
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Archive subtree (keeps IDs / saga FKs)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_world_node_subtree(
  p_world_profile_id UUID,
  p_place_id UUID,
  p_confirm BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

-- ---------------------------------------------------------------------------
-- Irreversible delete (subtree) — requires confirm when children/bindings
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_world_node(
  p_world_profile_id UUID,
  p_place_id UUID,
  p_confirm BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preview JSONB;
  v_ids UUID[];
  v_maps UUID[];
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

  SELECT COALESCE(array_agg(map_id), ARRAY[]::UUID[]) INTO v_maps
  FROM public.world_place_map_links
  WHERE world_profile_id = p_world_profile_id AND place_id = ANY (v_ids);

  -- Detach saga bindings (keep saga rows; clear place FK)
  UPDATE public.saga_asset_bindings
  SET world_place_id = NULL, updated_at = NOW()
  WHERE world_place_id = ANY (v_ids);

  DELETE FROM public.world_place_map_links
  WHERE world_profile_id = p_world_profile_id AND place_id = ANY (v_ids);

  DELETE FROM public.world_places
  WHERE world_profile_id = p_world_profile_id AND id = ANY (v_ids);

  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF cardinality(v_maps) > 0 THEN
    DELETE FROM public.world_atlas_maps
    WHERE world_profile_id = p_world_profile_id
      AND id = ANY (v_maps)
      AND kind <> 'world';
  END IF;

  RETURN jsonb_build_object(
    'deletedCount', v_n,
    'placeIds', to_jsonb(v_ids),
    'consequences', v_preview
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_world_node_consequences(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rename_world_node(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reparent_world_node(UUID, UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.duplicate_world_node(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_world_node_subtree(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_world_node(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.preview_world_node_consequences(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_world_node(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reparent_world_node(UUID, UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_world_node(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_world_node_subtree(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_world_node(UUID, UUID, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';

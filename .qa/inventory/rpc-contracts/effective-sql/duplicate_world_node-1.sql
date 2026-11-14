-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.duplicate_world_node(p_world_profile_id uuid, p_place_id uuid, p_deep boolean = FALSE) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

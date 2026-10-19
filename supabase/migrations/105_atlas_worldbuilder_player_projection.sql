-- #717 — Saga-aware atlas map list/detail + storage path authz (Epic #712).
-- Fail closed for non-editors without saga. No UI redesign.

-- ---------------------------------------------------------------------------
-- Helper: party-revealed map ids for a saga on a world
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atlas_wb_party_revealed_map_ids(
  p_world UUID,
  p_project UUID
)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT l.map_id), ARRAY[]::UUID[])
  FROM public.world_place_map_links l
  INNER JOIN public.world_places p
    ON p.id = l.place_id
   AND p.world_profile_id = p_world
   AND p.status = 'canonical'
  INNER JOIN public.saga_asset_bindings b
    ON b.world_place_id = p.id
   AND b.project_id = p_project
   AND b.asset_kind = 'location'
   AND b.reveal = 'party'
  WHERE l.world_profile_id = p_world
    AND l.usage = 'primary';
$$;

CREATE OR REPLACE FUNCTION public.atlas_wb_resolve_saga_project(
  p_world UUID,
  p_saga_public_id TEXT
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.projects
  WHERE public_id = upper(btrim(p_saga_public_id))
    AND world_profile_id = p_world
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- list_world_atlas_maps — saga-aware overload (replace 1-arg)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_world_atlas_maps(UUID);

CREATE OR REPLACE FUNCTION public.list_world_atlas_maps(
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

-- ensure_world_atlas_root: preserve create logic; return 3-arg list for editors
CREATE OR REPLACE FUNCTION public.ensure_world_atlas_root(p_world_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_can_edit_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_id
  FROM public.world_atlas_maps
  WHERE world_profile_id = p_world_profile_id
    AND parent_map_id IS NULL
  ORDER BY CASE WHEN kind = 'legacy_tiles' THEN 0 ELSE 1 END, sort_order
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.world_atlas_maps (
      world_profile_id, kind, title, generator_meta
    ) VALUES (
      p_world_profile_id,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.world_maps w WHERE w.world_profile_id = p_world_profile_id
      ) THEN 'legacy_tiles' ELSE 'world' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.world_maps w WHERE w.world_profile_id = p_world_profile_id
      ) THEN 'Kachelkarte (Legacy)' ELSE 'Weltkarte' END,
      jsonb_build_object(
        'engine',
        CASE WHEN EXISTS (
          SELECT 1 FROM public.world_maps w WHERE w.world_profile_id = p_world_profile_id
        ) THEN 'legacy_tiles' ELSE 'manual' END
      )
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN public.list_world_atlas_maps(p_world_profile_id, false, NULL);
END;
$$;

-- ---------------------------------------------------------------------------
-- get_world_atlas_map — party allow-list + redaction
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_world_atlas_map(UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.get_world_atlas_map(
  p_map_id UUID,
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
  v_row public.world_atlas_maps%ROWTYPE;
  v_layers JSONB;
  v_meta JSONB;
  v_can_edit BOOLEAN;
  v_party_only BOOLEAN;
  v_project UUID;
  v_allowed UUID[];
  v_parent UUID;
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

  v_can_edit := public.current_user_can_edit_world_profile(v_row.world_profile_id);
  v_party_only := (NOT v_can_edit) OR (p_player_view IS TRUE);

  IF v_party_only THEN
    IF p_saga_public_id IS NOT NULL AND btrim(p_saga_public_id) <> '' THEN
      v_project := public.atlas_wb_resolve_saga_project(v_row.world_profile_id, p_saga_public_id);
    END IF;
    IF v_project IS NULL THEN
      RAISE EXCEPTION 'not found' USING ERRCODE = 'P0002';
    END IF;
    v_allowed := public.atlas_wb_party_revealed_map_ids(v_row.world_profile_id, v_project);
    IF NOT (p_map_id = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  v_layers := COALESCE(v_row.layers, '{"type":"FeatureCollection","features":[]}'::jsonb);
  v_meta := COALESCE(v_row.generator_meta, '{}'::jsonb);
  v_parent := v_row.parent_map_id;

  IF v_party_only THEN
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

    IF v_parent IS NOT NULL AND NOT (v_parent = ANY (v_allowed)) THEN
      v_parent := NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'worldProfileId', v_row.world_profile_id,
    'parentMapId', v_parent,
    'kind', v_row.kind,
    'title', v_row.title,
    'sortOrder', v_row.sort_order,
    'bounds', v_row.bounds,
    'layers', v_layers,
    'basemapStoragePath', CASE
      WHEN v_party_only THEN v_row.basemap_storage_path
      ELSE v_row.basemap_storage_path
    END,
    'azgaarMapStoragePath', CASE
      WHEN v_party_only THEN NULL
      ELSE v_row.azgaar_map_storage_path
    END,
    'generatorMeta', v_meta,
    'revision', v_row.revision,
    'updatedAt', v_row.updated_at
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Storage path authorization (path: {userId}/{worldProfileId}/...)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_can_read_world_atlas_object(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parts TEXT[];
  v_world UUID;
BEGIN
  IF auth.uid() IS NULL OR p_object_name IS NULL THEN
    RETURN FALSE;
  END IF;
  v_parts := storage.foldername(p_object_name);
  IF cardinality(v_parts) < 2 THEN
    RETURN FALSE;
  END IF;
  -- Owner folder always OK
  IF v_parts[1] = auth.uid()::text THEN
    RETURN TRUE;
  END IF;
  BEGIN
    v_world := v_parts[2]::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;
  IF public.current_user_can_edit_world_profile(v_world) THEN
    RETURN TRUE;
  END IF;
  -- Party: only if some revealed primary map uses this basemap path
  RETURN EXISTS (
    SELECT 1
    FROM public.world_atlas_maps m
    INNER JOIN public.world_place_map_links l
      ON l.map_id = m.id AND l.usage = 'primary'
    INNER JOIN public.world_places p
      ON p.id = l.place_id AND p.status = 'canonical'
    INNER JOIN public.saga_asset_bindings b
      ON b.world_place_id = p.id
     AND b.asset_kind = 'location'
     AND b.reveal = 'party'
    INNER JOIN public.projects proj
      ON proj.id = b.project_id
     AND proj.world_profile_id = m.world_profile_id
    WHERE m.world_profile_id = v_world
      AND (
        m.basemap_storage_path = p_object_name
        OR m.azgaar_map_storage_path = p_object_name
      )
      AND public.current_user_can_read_world_profile(v_world)
  );
END;
$$;

DROP POLICY IF EXISTS "Users can read world atlas assets" ON storage.objects;
CREATE POLICY "Users can read world atlas assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'world-atlas'
    AND public.current_user_can_read_world_atlas_object(name)
  );

-- Compatibility wrapper for upsert_world_atlas_map → get_world_atlas_map(id, false)
CREATE OR REPLACE FUNCTION public.get_world_atlas_map(
  p_map_id UUID,
  p_player_view BOOLEAN
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_world_atlas_map(p_map_id, p_player_view, NULL::text);
$$;

REVOKE ALL ON FUNCTION public.list_world_atlas_maps(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_world_atlas_map(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_world_atlas_map(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_world_atlas_maps(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_world_atlas_map(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_world_atlas_map(UUID, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';

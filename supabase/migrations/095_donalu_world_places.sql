-- #donalu-world-workspace — Donalu rename (WO-9FFK6 only) + world_places + map links + saga FK.
-- Idempotent where practical. No mass rename of other Dornhain profiles.

-- ---------------------------------------------------------------------------
-- P1: Scoped world rename
-- ---------------------------------------------------------------------------
UPDATE public.world_profiles
SET
  name = 'Donalu',
  description = COALESCE(
    NULLIF(btrim(description), ''),
    'Fantasy-Welt. Dornhain ist eine Stadt in Donalu (Starter für Das Flüstern unter Dornhain).'
  ),
  updated_at = NOW()
WHERE public_id = 'WO-9FFK6'
  AND name IS DISTINCT FROM 'Donalu';

-- ---------------------------------------------------------------------------
-- P2: world_places
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.world_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_profile_id UUID NOT NULL REFERENCES public.world_profiles(id) ON DELETE CASCADE,
  parent_place_id UUID REFERENCES public.world_places(id) ON DELETE SET NULL,
  kind TEXT NOT NULL
    CHECK (kind IN (
      'continent', 'realm', 'region', 'settlement', 'district',
      'site', 'building', 'interior', 'dungeon', 'area'
    )),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) > 0),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'canonical'
    CHECK (status IN ('draft', 'canonical', 'archived')),
  seed_key TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  revision BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT world_places_parent_not_self CHECK (
    parent_place_id IS NULL OR parent_place_id <> id
  ),
  CONSTRAINT world_places_seed_key_unique UNIQUE (world_profile_id, seed_key)
);

CREATE INDEX IF NOT EXISTS world_places_world_idx
  ON public.world_places (world_profile_id, sort_order, name);

CREATE INDEX IF NOT EXISTS world_places_parent_idx
  ON public.world_places (parent_place_id);

ALTER TABLE public.world_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "world_places_select" ON public.world_places;
DROP POLICY IF EXISTS "world_places_insert" ON public.world_places;
DROP POLICY IF EXISTS "world_places_update" ON public.world_places;
DROP POLICY IF EXISTS "world_places_delete" ON public.world_places;

CREATE POLICY "world_places_select" ON public.world_places
  FOR SELECT TO authenticated
  USING (public.current_user_can_read_world_profile(world_profile_id));

CREATE POLICY "world_places_insert" ON public.world_places
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_world_profile(world_profile_id));

CREATE POLICY "world_places_update" ON public.world_places
  FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_world_profile(world_profile_id))
  WITH CHECK (public.current_user_can_edit_world_profile(world_profile_id));

CREATE POLICY "world_places_delete" ON public.world_places
  FOR DELETE TO authenticated
  USING (public.current_user_can_edit_world_profile(world_profile_id));

-- Same-world parent enforcement
CREATE OR REPLACE FUNCTION public.world_places_enforce_same_world()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_place_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.world_places p
      WHERE p.id = NEW.parent_place_id
        AND p.world_profile_id = NEW.world_profile_id
    ) THEN
      RAISE EXCEPTION 'parent_place must be in same world' USING ERRCODE = '23514';
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_world_places_same_world ON public.world_places;
CREATE TRIGGER trg_world_places_same_world
  BEFORE INSERT OR UPDATE ON public.world_places
  FOR EACH ROW EXECUTE FUNCTION public.world_places_enforce_same_world();

-- ---------------------------------------------------------------------------
-- world_place_map_links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.world_place_map_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_profile_id UUID NOT NULL REFERENCES public.world_profiles(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.world_places(id) ON DELETE CASCADE,
  map_id UUID NOT NULL REFERENCES public.world_atlas_maps(id) ON DELETE CASCADE,
  usage TEXT NOT NULL DEFAULT 'overview'
    CHECK (usage IN ('overview', 'footprint', 'entrance', 'interior', 'dungeon', 'battlemap')),
  feature_id TEXT,
  anchor JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT world_place_map_links_unique UNIQUE (place_id, map_id, usage)
);

CREATE INDEX IF NOT EXISTS world_place_map_links_place_idx
  ON public.world_place_map_links (place_id);

CREATE INDEX IF NOT EXISTS world_place_map_links_map_idx
  ON public.world_place_map_links (map_id);

ALTER TABLE public.world_place_map_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "world_place_map_links_select" ON public.world_place_map_links;
DROP POLICY IF EXISTS "world_place_map_links_insert" ON public.world_place_map_links;
DROP POLICY IF EXISTS "world_place_map_links_update" ON public.world_place_map_links;
DROP POLICY IF EXISTS "world_place_map_links_delete" ON public.world_place_map_links;

CREATE POLICY "world_place_map_links_select" ON public.world_place_map_links
  FOR SELECT TO authenticated
  USING (public.current_user_can_read_world_profile(world_profile_id));

CREATE POLICY "world_place_map_links_insert" ON public.world_place_map_links
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_world_profile(world_profile_id));

CREATE POLICY "world_place_map_links_update" ON public.world_place_map_links
  FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_world_profile(world_profile_id))
  WITH CHECK (public.current_user_can_edit_world_profile(world_profile_id));

CREATE POLICY "world_place_map_links_delete" ON public.world_place_map_links
  FOR DELETE TO authenticated
  USING (public.current_user_can_edit_world_profile(world_profile_id));

CREATE OR REPLACE FUNCTION public.world_place_map_links_enforce_same_world()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.world_places p
    WHERE p.id = NEW.place_id AND p.world_profile_id = NEW.world_profile_id
  ) THEN
    RAISE EXCEPTION 'place/map link world mismatch (place)' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.world_atlas_maps m
    WHERE m.id = NEW.map_id AND m.world_profile_id = NEW.world_profile_id
  ) THEN
    RAISE EXCEPTION 'place/map link world mismatch (map)' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_world_place_map_links_same_world ON public.world_place_map_links;
CREATE TRIGGER trg_world_place_map_links_same_world
  BEFORE INSERT OR UPDATE ON public.world_place_map_links
  FOR EACH ROW EXECUTE FUNCTION public.world_place_map_links_enforce_same_world();

-- ---------------------------------------------------------------------------
-- saga_asset_bindings.world_place_id + saga_place_state
-- ---------------------------------------------------------------------------
ALTER TABLE public.saga_asset_bindings
  ADD COLUMN IF NOT EXISTS world_place_id UUID REFERENCES public.world_places(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS saga_asset_bindings_world_place_idx
  ON public.saga_asset_bindings (world_place_id)
  WHERE world_place_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.saga_place_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.world_places(id) ON DELETE CASCADE,
  discovery_state TEXT NOT NULL DEFAULT 'unknown'
    CHECK (discovery_state IN ('unknown', 'rumored', 'known', 'visited')),
  visit_state TEXT NOT NULL DEFAULT 'never'
    CHECK (visit_state IN ('never', 'approached', 'entered', 'cleared')),
  gm_notes TEXT NOT NULL DEFAULT '',
  revision BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT saga_place_state_unique UNIQUE (project_id, place_id)
);

CREATE INDEX IF NOT EXISTS saga_place_state_project_idx
  ON public.saga_place_state (project_id);

ALTER TABLE public.saga_place_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saga_place_state_select" ON public.saga_place_state;
DROP POLICY IF EXISTS "saga_place_state_write" ON public.saga_place_state;

-- Members can read; GM/edit via project membership (reuse can_view_saga_binding pattern loosely)
CREATE POLICY "saga_place_state_select" ON public.saga_place_state
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (
          p.gm_user_id = auth.uid()
          OR public.current_user_is_active_project_member(p.id)
        )
    )
  );

CREATE POLICY "saga_place_state_write" ON public.saga_place_state
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.gm_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.gm_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Backfill Donalu places + maps (WO-9FFK6 only)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_world UUID;
  v_root_map UUID;
  v_city_map UUID;
  v_tavern_map UUID;
  v_crypt_map UUID;
  v_dornhain UUID;
  v_tavern UUID;
  v_market UUID;
  v_woods UUID;
  v_crypt UUID;
  v_bandit UUID;
  v_project UUID;
BEGIN
  SELECT id INTO v_world FROM public.world_profiles WHERE public_id = 'WO-9FFK6';
  IF v_world IS NULL THEN
    RAISE NOTICE 'WO-9FFK6 missing — skip Donalu place backfill';
    RETURN;
  END IF;

  -- Ensure unified world root map
  SELECT id INTO v_root_map
  FROM public.world_atlas_maps
  WHERE world_profile_id = v_world AND kind = 'world'
  ORDER BY sort_order, created_at
  LIMIT 1;

  IF v_root_map IS NULL THEN
    INSERT INTO public.world_atlas_maps (
      world_profile_id, parent_map_id, kind, title, sort_order, generator_meta
    ) VALUES (
      v_world, NULL, 'world', 'Weltkarte (Unified)', 10,
      jsonb_build_object('engine', 'unified_canvas')
    )
    RETURNING id INTO v_root_map;
  END IF;

  -- Places
  INSERT INTO public.world_places (world_profile_id, parent_place_id, kind, name, description, status, seed_key, sort_order)
  VALUES (v_world, NULL, 'settlement', 'Dornhain', 'Stadt in Donalu', 'canonical', 'place.dornhain', 10)
  ON CONFLICT (world_profile_id, seed_key) DO UPDATE
    SET name = EXCLUDED.name, kind = EXCLUDED.kind, status = EXCLUDED.status
  RETURNING id INTO v_dornhain;
  SELECT id INTO v_dornhain FROM public.world_places WHERE world_profile_id = v_world AND seed_key = 'place.dornhain';

  INSERT INTO public.world_places (world_profile_id, parent_place_id, kind, name, description, status, seed_key, sort_order)
  VALUES (v_world, v_dornhain, 'building', 'Taverne Zum Flüstern', NULL, 'canonical', 'loc.tavern', 20)
  ON CONFLICT (world_profile_id, seed_key) DO UPDATE
    SET parent_place_id = EXCLUDED.parent_place_id, name = EXCLUDED.name, kind = EXCLUDED.kind
  RETURNING id INTO v_tavern;
  SELECT id INTO v_tavern FROM public.world_places WHERE world_profile_id = v_world AND seed_key = 'loc.tavern';

  INSERT INTO public.world_places (world_profile_id, parent_place_id, kind, name, description, status, seed_key, sort_order)
  VALUES (v_world, v_dornhain, 'site', 'Marktplatz Dornhain', NULL, 'canonical', 'loc.market', 30)
  ON CONFLICT (world_profile_id, seed_key) DO UPDATE
    SET parent_place_id = EXCLUDED.parent_place_id, name = EXCLUDED.name
  RETURNING id INTO v_market;
  SELECT id INTO v_market FROM public.world_places WHERE world_profile_id = v_world AND seed_key = 'loc.market';

  INSERT INTO public.world_places (world_profile_id, parent_place_id, kind, name, description, status, seed_key, sort_order)
  VALUES (v_world, NULL, 'area', 'Schattenwald', 'Parent region TBD', 'canonical', 'loc.woods', 40)
  ON CONFLICT (world_profile_id, seed_key) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_woods;
  SELECT id INTO v_woods FROM public.world_places WHERE world_profile_id = v_world AND seed_key = 'loc.woods';

  INSERT INTO public.world_places (world_profile_id, parent_place_id, kind, name, description, status, seed_key, sort_order)
  VALUES (v_world, NULL, 'dungeon', 'Krypta unter dem Hügel', 'Parent/entrance TBD', 'canonical', 'loc.crypt', 50)
  ON CONFLICT (world_profile_id, seed_key) DO UPDATE SET name = EXCLUDED.name, kind = EXCLUDED.kind
  RETURNING id INTO v_crypt;
  SELECT id INTO v_crypt FROM public.world_places WHERE world_profile_id = v_world AND seed_key = 'loc.crypt';

  INSERT INTO public.world_places (world_profile_id, parent_place_id, kind, name, description, status, seed_key, sort_order)
  VALUES (v_world, NULL, 'site', 'Banditenlager (falsche Spur)', 'Parent TBD', 'canonical', 'loc.bandit-camp', 60)
  ON CONFLICT (world_profile_id, seed_key) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_bandit;
  SELECT id INTO v_bandit FROM public.world_places WHERE world_profile_id = v_world AND seed_key = 'loc.bandit-camp';

  -- Child maps
  SELECT id INTO v_city_map FROM public.world_atlas_maps
  WHERE world_profile_id = v_world AND kind = 'settlement' AND title = 'Dornhain (Stadt)'
  LIMIT 1;
  IF v_city_map IS NULL THEN
    INSERT INTO public.world_atlas_maps (
      world_profile_id, parent_map_id, kind, title, sort_order, bounds, generator_meta
    ) VALUES (
      v_world, v_root_map, 'settlement', 'Dornhain (Stadt)', 20,
      '{"minX":0,"minY":0,"maxX":400,"maxY":400}'::jsonb,
      jsonb_build_object('engine', 'unified_canvas', 'placeSeedKey', 'place.dornhain')
    )
    RETURNING id INTO v_city_map;
  END IF;

  SELECT id INTO v_tavern_map FROM public.world_atlas_maps
  WHERE world_profile_id = v_world AND kind = 'scene' AND title = 'Taverne Zum Flüstern (Innenraum)'
  LIMIT 1;
  IF v_tavern_map IS NULL THEN
    INSERT INTO public.world_atlas_maps (
      world_profile_id, parent_map_id, kind, title, sort_order, bounds, generator_meta
    ) VALUES (
      v_world, v_city_map, 'scene', 'Taverne Zum Flüstern (Innenraum)', 30,
      '{"minX":0,"minY":0,"maxX":80,"maxY":60}'::jsonb,
      jsonb_build_object('engine', 'unified_canvas', 'placeSeedKey', 'loc.tavern', 'detailMissing', false)
    )
    RETURNING id INTO v_tavern_map;
  END IF;

  SELECT id INTO v_crypt_map FROM public.world_atlas_maps
  WHERE world_profile_id = v_world AND kind = 'scene' AND title = 'Krypta unter dem Hügel (Dungeon)'
  LIMIT 1;
  IF v_crypt_map IS NULL THEN
    INSERT INTO public.world_atlas_maps (
      world_profile_id, parent_map_id, kind, title, sort_order, bounds, generator_meta
    ) VALUES (
      v_world, v_root_map, 'scene', 'Krypta unter dem Hügel (Dungeon)', 40,
      '{"minX":0,"minY":0,"maxX":200,"maxY":200}'::jsonb,
      jsonb_build_object(
        'engine', 'unified_canvas',
        'placeSeedKey', 'loc.crypt',
        'dungeon', jsonb_build_object('awaitingGenerate', true)
      )
    )
    RETURNING id INTO v_crypt_map;
  END IF;

  -- Map links
  INSERT INTO public.world_place_map_links (world_profile_id, place_id, map_id, usage, anchor)
  VALUES
    (v_world, v_dornhain, v_root_map, 'overview', '{"x":200,"y":180}'::jsonb),
    (v_world, v_dornhain, v_city_map, 'footprint', '{}'::jsonb),
    (v_world, v_tavern, v_city_map, 'footprint', '{"x":120,"y":140}'::jsonb),
    (v_world, v_tavern, v_tavern_map, 'interior', '{}'::jsonb),
    (v_world, v_market, v_city_map, 'footprint', '{"x":200,"y":160}'::jsonb),
    (v_world, v_woods, v_root_map, 'overview', '{"x":320,"y":220}'::jsonb),
    (v_world, v_crypt, v_root_map, 'entrance', '{"x":260,"y":260}'::jsonb),
    (v_world, v_crypt, v_crypt_map, 'dungeon', '{}'::jsonb),
    (v_world, v_bandit, v_root_map, 'overview', '{"x":340,"y":280}'::jsonb)
  ON CONFLICT (place_id, map_id, usage) DO NOTHING;

  -- Link saga location bindings for SA-E979J
  SELECT id INTO v_project FROM public.projects WHERE public_id = 'SA-E979J';
  IF v_project IS NOT NULL THEN
    UPDATE public.saga_asset_bindings b
    SET world_place_id = p.id, updated_at = NOW()
    FROM public.world_places p
    WHERE b.project_id = v_project
      AND b.asset_kind = 'location'
      AND p.world_profile_id = v_world
      AND p.seed_key = b.asset_id
      AND (b.world_place_id IS DISTINCT FROM p.id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
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

  IF p_saga_public_id IS NOT NULL AND btrim(p_saga_public_id) <> '' THEN
    SELECT id INTO v_project
    FROM public.projects
    WHERE public_id = upper(btrim(p_saga_public_id))
      AND world_profile_id = p_world_profile_id;
  END IF;

  IF p_player_view AND v_project IS NOT NULL THEN
    -- Only places linked to party-visible location bindings
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

CREATE OR REPLACE FUNCTION public.list_world_place_map_links(p_world_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_rows JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_can_read_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
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
  WHERE l.world_profile_id = p_world_profile_id;

  RETURN jsonb_build_object('links', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_world_place(
  p_world_profile_id UUID,
  p_place_id UUID,
  p_parent_place_id UUID,
  p_kind TEXT,
  p_name TEXT,
  p_description TEXT,
  p_status TEXT,
  p_seed_key TEXT,
  p_sort_order INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

REVOKE ALL ON FUNCTION public.list_world_places(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_world_place_map_links(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_world_place(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.list_world_places(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_world_place_map_links(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_world_place(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INT) TO authenticated;

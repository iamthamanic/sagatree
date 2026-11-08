-- #715 — Additive WorldNode create-with-primary-maps (Epic #712).
-- Expand-only: keep legacy kinds readable; add country/place/room + placeholder status + primary usage.
-- No mass backfill. No DELETE of existing rows.

-- ---------------------------------------------------------------------------
-- Expand CHECK constraints (drop + recreate with union of old + new)
-- ---------------------------------------------------------------------------
ALTER TABLE public.world_places DROP CONSTRAINT IF EXISTS world_places_kind_check;
ALTER TABLE public.world_places ADD CONSTRAINT world_places_kind_check CHECK (
  kind IN (
    -- legacy
    'continent', 'realm', 'region', 'settlement', 'district',
    'site', 'building', 'interior', 'dungeon', 'area',
    -- canonical (#712)
    'country', 'place', 'room'
  )
);

ALTER TABLE public.world_places DROP CONSTRAINT IF EXISTS world_places_status_check;
ALTER TABLE public.world_places ADD CONSTRAINT world_places_status_check CHECK (
  status IN ('placeholder', 'draft', 'canonical', 'archived')
);

ALTER TABLE public.world_places
  ADD COLUMN IF NOT EXISTS subtype TEXT;

ALTER TABLE public.world_place_map_links DROP CONSTRAINT IF EXISTS world_place_map_links_usage_check;
ALTER TABLE public.world_place_map_links ADD CONSTRAINT world_place_map_links_usage_check CHECK (
  usage IN (
    'overview', 'footprint', 'entrance', 'interior', 'dungeon', 'battlemap',
    'primary'
  )
);

-- At most one primary map link per place
CREATE UNIQUE INDEX IF NOT EXISTS world_place_map_links_primary_uidx
  ON public.world_place_map_links (place_id)
  WHERE usage = 'primary';

-- ---------------------------------------------------------------------------
-- Idempotency ledger for create_world_node_with_maps
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.world_node_create_idempotency (
  world_profile_id UUID NOT NULL REFERENCES public.world_profiles(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (world_profile_id, idempotency_key)
);

ALTER TABLE public.world_node_create_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "world_node_create_idempotency_select" ON public.world_node_create_idempotency;
DROP POLICY IF EXISTS "world_node_create_idempotency_insert" ON public.world_node_create_idempotency;

CREATE POLICY "world_node_create_idempotency_select" ON public.world_node_create_idempotency
  FOR SELECT TO authenticated
  USING (public.current_user_can_edit_world_profile(world_profile_id));

CREATE POLICY "world_node_create_idempotency_insert" ON public.world_node_create_idempotency
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_world_profile(world_profile_id));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atlas_wb_required_parent_kind(p_kind TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_kind
    WHEN 'continent' THEN NULL
    WHEN 'country' THEN 'continent'
    WHEN 'place' THEN 'country'
    WHEN 'building' THEN 'place'
    WHEN 'room' THEN 'building'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_wb_is_canonical_kind(p_kind TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_kind IN ('continent', 'country', 'place', 'building', 'room');
$$;

-- Organizational rank (lower = higher in tree). Legacy kinds map onto canonical ranks.
CREATE OR REPLACE FUNCTION public.atlas_wb_kind_rank(p_kind TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_kind
    WHEN 'continent' THEN 0
    WHEN 'country' THEN 1
    WHEN 'realm' THEN 1
    WHEN 'place' THEN 2
    WHEN 'settlement' THEN 2
    WHEN 'area' THEN 2
    WHEN 'region' THEN 2
    WHEN 'building' THEN 3
    WHEN 'dungeon' THEN 3
    WHEN 'site' THEN 3
    WHEN 'room' THEN 4
    WHEN 'interior' THEN 4
    ELSE NULL
  END;
$$;

-- Whether tip_kind may stand in for the required immediate parent kind (incl. legacy).
CREATE OR REPLACE FUNCTION public.atlas_wb_tip_satisfies(p_need TEXT, p_tip TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_need IS NULL THEN p_tip IS NULL
    WHEN p_tip IS NULL THEN FALSE
    WHEN p_need = 'continent' THEN p_tip = 'continent'
    WHEN p_need = 'country' THEN p_tip IN ('country', 'realm')
    WHEN p_need = 'place' THEN p_tip IN ('place', 'settlement', 'area', 'region')
    WHEN p_need = 'building' THEN p_tip IN ('building', 'dungeon', 'site')
    WHEN p_need = 'room' THEN p_tip IN ('room', 'interior')
    ELSE FALSE
  END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_wb_placeholder_stem(p_kind TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_kind
    WHEN 'continent' THEN 'Unbenannter Kontinent'
    WHEN 'country' THEN 'Unbenanntes Land'
    WHEN 'place' THEN 'Unbenannter Ort'
    WHEN 'building' THEN 'Unbenanntes Gebäude'
    WHEN 'room' THEN 'Unbenannter Raum'
    ELSE 'Unbenannt'
  END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_wb_map_kind_for_node(p_kind TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_kind
    WHEN 'continent' THEN 'region'
    WHEN 'country' THEN 'region'
    WHEN 'place' THEN 'settlement'
    ELSE 'scene'
  END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_wb_next_placeholder_name(
  p_world UUID,
  p_parent UUID,
  p_kind TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_stem TEXT := public.atlas_wb_placeholder_stem(p_kind);
  v_n INT;
BEGIN
  SELECT COUNT(*)::INT + 1 INTO v_n
  FROM public.world_places
  WHERE world_profile_id = p_world
    AND kind = p_kind
    AND status = 'placeholder'
    AND (
      (p_parent IS NULL AND parent_place_id IS NULL)
      OR parent_place_id = p_parent
    );
  RETURN v_stem || ' ' || v_n::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_wb_ensure_world_root_map(p_world UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.world_atlas_maps
  WHERE world_profile_id = p_world
    AND kind = 'world'
    AND parent_map_id IS NULL
  ORDER BY sort_order ASC, created_at ASC
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.world_atlas_maps (
      world_profile_id, parent_map_id, kind, title, sort_order, bounds, generator_meta
    ) VALUES (
      p_world, NULL, 'world', 'Weltkarte', 0,
      '{"minX":0,"minY":0,"maxX":1000,"maxY":1000}'::jsonb,
      jsonb_build_object('engine', 'unified_canvas', 'mapStatus', 'unsketched')
    )
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.atlas_wb_create_primary_map(
  p_world UUID,
  p_place UUID,
  p_kind TEXT,
  p_title TEXT,
  p_parent_map UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_map UUID;
  v_map_kind TEXT := public.atlas_wb_map_kind_for_node(p_kind);
BEGIN
  -- Own local frame — do NOT copy parent bounds
  INSERT INTO public.world_atlas_maps (
    world_profile_id, parent_map_id, kind, title, sort_order, bounds, generator_meta
  ) VALUES (
    p_world,
    p_parent_map,
    v_map_kind,
    p_title,
    0,
    '{"minX":0,"minY":0,"maxX":1000,"maxY":1000}'::jsonb,
    jsonb_build_object(
      'engine', 'unified_canvas',
      'mapStatus', 'unlocated',
      'placeId', p_place
    )
  )
  RETURNING id INTO v_map;

  INSERT INTO public.world_place_map_links (
    world_profile_id, place_id, map_id, usage, anchor
  ) VALUES (
    p_world, p_place, v_map, 'primary', '{}'::jsonb
  );

  RETURN v_map;
END;
$$;

-- ---------------------------------------------------------------------------
-- Main RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_world_node_with_maps(
  p_world_profile_id UUID,
  p_kind TEXT,
  p_name TEXT,
  p_idempotency_key TEXT,
  p_subtype TEXT DEFAULT NULL,
  p_parent_place_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

REVOKE ALL ON FUNCTION public.create_world_node_with_maps(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_world_node_with_maps(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT)
  TO authenticated;

NOTIFY pgrst, 'reload schema';

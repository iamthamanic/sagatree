-- #754: gated, idempotent Donalu hierarchy/map backfill apply + rollback.
-- Expand-only. Never auto-classifies site/dungeon/area/region.
-- Requires atlas_wb_migration_gates.enabled = true for the target world.
-- Production confirm token is separate from staging.

CREATE TABLE IF NOT EXISTS public.atlas_wb_migration_apply_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_profile_id UUID NOT NULL REFERENCES public.world_profiles(id) ON DELETE CASCADE,
  target TEXT NOT NULL CHECK (target IN ('staging', 'production')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rolled_back_at TIMESTAMPTZ,
  created_place_ids UUID[] NOT NULL DEFAULT '{}',
  created_map_ids UUID[] NOT NULL DEFAULT '{}',
  created_link_ids UUID[] NOT NULL DEFAULT '{}',
  parent_rewrites JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS atlas_wb_migration_apply_batches_world_idx
  ON public.atlas_wb_migration_apply_batches (world_profile_id, applied_at DESC);

ALTER TABLE public.atlas_wb_migration_apply_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atlas_wb_migration_apply_batches_owner_select
  ON public.atlas_wb_migration_apply_batches;
CREATE POLICY atlas_wb_migration_apply_batches_owner_select
  ON public.atlas_wb_migration_apply_batches
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.world_profiles wp
      WHERE wp.id = world_profile_id
        AND wp.owner_user_id = auth.uid()
    )
  );

REVOKE ALL ON TABLE public.atlas_wb_migration_apply_batches FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.atlas_wb_migration_apply_batches TO authenticated;

-- Identity snapshot for pre/post UUID + Saga/reveal diffs (read-only).
CREATE OR REPLACE FUNCTION public.atlas_wb_migration_identity_snapshot(
  p_world_profile_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_owner UUID;
  v_gate BOOLEAN;
BEGIN
  SELECT owner_user_id INTO v_owner
  FROM public.world_profiles
  WHERE id = p_world_profile_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'world not found' USING ERRCODE = 'P0002';
  END IF;

  -- Owner via JWT, or operator session (postgres) after SET LOCAL atlas.migration_operator.
  IF v_user IS NOT NULL AND v_user <> v_owner THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_user IS NULL
     AND current_setting('atlas.migration_operator', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(g.enabled, false) INTO v_gate
  FROM public.atlas_wb_migration_gates g
  WHERE g.world_profile_id = p_world_profile_id;

  RETURN jsonb_build_object(
    'world_profile_id', p_world_profile_id,
    'gate_enabled', COALESCE(v_gate, false),
    'places', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'kind', p.kind,
        'name', p.name,
        'parent_place_id', p.parent_place_id,
        'status', p.status,
        'seed_key', p.seed_key,
        'revision', p.revision
      ) ORDER BY p.id), '[]'::jsonb)
      FROM public.world_places p
      WHERE p.world_profile_id = p_world_profile_id
    ),
    'maps', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', m.id,
        'kind', m.kind,
        'title', m.title,
        'parent_map_id', m.parent_map_id,
        'revision', m.revision
      ) ORDER BY m.id), '[]'::jsonb)
      FROM public.world_atlas_maps m
      WHERE m.world_profile_id = p_world_profile_id
    ),
    'links', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', l.id,
        'place_id', l.place_id,
        'map_id', l.map_id,
        'usage', l.usage
      ) ORDER BY l.id), '[]'::jsonb)
      FROM public.world_place_map_links l
      WHERE l.world_profile_id = p_world_profile_id
    ),
    'saga_bindings', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', b.id,
        'project_id', b.project_id,
        'asset_kind', b.asset_kind,
        'asset_id', b.asset_id,
        'reveal', b.reveal,
        'world_place_id', b.world_place_id
      ) ORDER BY b.id), '[]'::jsonb)
      FROM public.saga_asset_bindings b
      WHERE b.world_place_id IN (
        SELECT id FROM public.world_places WHERE world_profile_id = p_world_profile_id
      )
    ),
    'invalid_parent_edges', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', c.id, 'kind', c.kind, 'parent_kind', par.kind
      ) ORDER BY c.id), '[]'::jsonb)
      FROM public.world_places c
      LEFT JOIN public.world_places par ON par.id = c.parent_place_id
      WHERE c.world_profile_id = p_world_profile_id
        AND c.status IS DISTINCT FROM 'archived'
        AND c.parent_place_id IS NOT NULL
        AND par.id IS NULL
    ),
    'duplicate_primary_maps', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'place_id', place_id, 'n', n
      ) ORDER BY place_id), '[]'::jsonb)
      FROM (
        SELECT place_id, count(*)::int AS n
        FROM public.world_place_map_links
        WHERE world_profile_id = p_world_profile_id
          AND usage = 'primary'
        GROUP BY place_id
        HAVING count(*) > 1
      ) d
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.atlas_wb_migration_identity_snapshot(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atlas_wb_migration_identity_snapshot(UUID) TO authenticated;

-- Ensure a primary map link without inventing a second map when a link already exists.
CREATE OR REPLACE FUNCTION public.atlas_wb_migration_ensure_primary_link(
  p_world UUID,
  p_place UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing UUID;
  v_map UUID;
  v_link UUID;
  v_kind TEXT;
  v_name TEXT;
  v_parent_map UUID;
  v_root UUID;
BEGIN
  SELECT l.id INTO v_existing
  FROM public.world_place_map_links l
  WHERE l.place_id = p_place AND l.usage = 'primary'
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Prefer overview → footprint → any existing link (retain map UUID).
  SELECT l.map_id INTO v_map
  FROM public.world_place_map_links l
  WHERE l.place_id = p_place
  ORDER BY CASE l.usage
    WHEN 'overview' THEN 0
    WHEN 'footprint' THEN 1
    WHEN 'entrance' THEN 2
    WHEN 'interior' THEN 3
    WHEN 'dungeon' THEN 4
    ELSE 5
  END, l.created_at ASC
  LIMIT 1;

  IF v_map IS NOT NULL THEN
    INSERT INTO public.world_place_map_links (
      world_profile_id, place_id, map_id, usage, anchor
    ) VALUES (
      p_world, p_place, v_map, 'primary', '{}'::jsonb
    )
    RETURNING id INTO v_link;
    RETURN v_link;
  END IF;

  SELECT kind, name INTO v_kind, v_name
  FROM public.world_places
  WHERE id = p_place AND world_profile_id = p_world;

  SELECT map_id INTO v_parent_map
  FROM public.world_place_map_links
  WHERE place_id = (
    SELECT parent_place_id FROM public.world_places WHERE id = p_place
  ) AND usage = 'primary'
  LIMIT 1;

  v_root := public.atlas_wb_ensure_world_root_map(p_world);
  v_map := public.atlas_wb_create_primary_map(
    p_world,
    p_place,
    COALESCE(v_kind, 'place'),
    COALESCE(v_name, 'Ort') || ' (Karte)',
    COALESCE(v_parent_map, v_root)
  );

  SELECT id INTO v_link
  FROM public.world_place_map_links
  WHERE place_id = p_place AND usage = 'primary'
  LIMIT 1;
  RETURN v_link;
END;
$$;

REVOKE ALL ON FUNCTION public.atlas_wb_migration_ensure_primary_link(UUID, UUID)
  FROM PUBLIC, anon;

-- Apply expand-only remediations (placeholders + primary links + parent_map repair).
CREATE OR REPLACE FUNCTION public.atlas_wb_migration_apply(
  p_world_profile_id UUID,
  p_target TEXT,
  p_confirm TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_owner UUID;
  v_gate BOOLEAN := false;
  v_batch UUID := gen_random_uuid();
  v_created_places UUID[] := '{}';
  v_created_maps UUID[] := '{}';
  v_created_links UUID[] := '{}';
  v_rewrites JSONB := '[]'::jsonb;
  v_orphan RECORD;
  v_continent UUID;
  v_country UUID;
  v_cont_seed TEXT;
  v_country_seed TEXT;
  v_cont_name TEXT;
  v_country_name TEXT;
  v_root_map UUID;
  v_cont_map UUID;
  v_country_map UUID;
  v_old_parent UUID;
  v_link UUID;
  v_place_row RECORD;
  v_before_places INT;
  v_after_places INT;
BEGIN
  IF p_target IS DISTINCT FROM 'staging' AND p_target IS DISTINCT FROM 'production' THEN
    RAISE EXCEPTION 'target must be staging|production' USING ERRCODE = '22023';
  END IF;
  IF p_target = 'staging' AND p_confirm IS DISTINCT FROM 'STAGING_APPLY' THEN
    RAISE EXCEPTION 'staging confirm token required' USING ERRCODE = '42501';
  END IF;
  IF p_target = 'production' AND p_confirm IS DISTINCT FROM 'PRODUCTION_APPLY_APPROVED' THEN
    RAISE EXCEPTION 'production confirm token required' USING ERRCODE = '42501';
  END IF;

  SELECT owner_user_id INTO v_owner
  FROM public.world_profiles
  WHERE id = p_world_profile_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'world not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_user IS NOT NULL AND v_user <> v_owner THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_user IS NULL
     AND current_setting('atlas.migration_operator', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(g.enabled, false) INTO v_gate
  FROM public.atlas_wb_migration_gates g
  WHERE g.world_profile_id = p_world_profile_id;
  IF NOT COALESCE(v_gate, false) THEN
    RAISE EXCEPTION 'migration gate disabled for world' USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::int INTO v_before_places
  FROM public.world_places
  WHERE world_profile_id = p_world_profile_id;

  v_root_map := public.atlas_wb_ensure_world_root_map(p_world_profile_id);

  -- Orphan settlements / places (null parent) → continent → country placeholders.
  FOR v_orphan IN
    SELECT p.id, p.kind, p.name, p.parent_place_id
    FROM public.world_places p
    WHERE p.world_profile_id = p_world_profile_id
      AND p.parent_place_id IS NULL
      AND p.status IS DISTINCT FROM 'archived'
      AND p.kind IN ('settlement', 'place')
      AND COALESCE(p.seed_key, '') NOT LIKE 'mig.ph.%'
  LOOP
    v_cont_seed := 'mig.ph.continent.' || v_orphan.id::text;
    v_country_seed := 'mig.ph.country.' || v_orphan.id::text;

    SELECT id INTO v_continent
    FROM public.world_places
    WHERE world_profile_id = p_world_profile_id AND seed_key = v_cont_seed;

    IF v_continent IS NULL THEN
      v_cont_name := public.atlas_wb_next_placeholder_name(
        p_world_profile_id, NULL, 'continent'
      );
      INSERT INTO public.world_places (
        world_profile_id, parent_place_id, kind, name, status, seed_key, sort_order
      ) VALUES (
        p_world_profile_id, NULL, 'continent', v_cont_name, 'placeholder', v_cont_seed, 0
      )
      RETURNING id INTO v_continent;
      v_created_places := array_append(v_created_places, v_continent);

      v_cont_map := public.atlas_wb_create_primary_map(
        p_world_profile_id, v_continent, 'continent',
        v_cont_name || ' (Karte)', v_root_map
      );
      v_created_maps := array_append(v_created_maps, v_cont_map);
      SELECT id INTO v_link FROM public.world_place_map_links
      WHERE place_id = v_continent AND usage = 'primary' LIMIT 1;
      IF v_link IS NOT NULL THEN
        v_created_links := array_append(v_created_links, v_link);
      END IF;
    ELSE
      SELECT map_id INTO v_cont_map
      FROM public.world_place_map_links
      WHERE place_id = v_continent AND usage = 'primary'
      LIMIT 1;
      IF v_cont_map IS NULL THEN
        v_link := public.atlas_wb_migration_ensure_primary_link(
          p_world_profile_id, v_continent
        );
        SELECT map_id INTO v_cont_map
        FROM public.world_place_map_links WHERE id = v_link;
      END IF;
    END IF;

    SELECT id INTO v_country
    FROM public.world_places
    WHERE world_profile_id = p_world_profile_id AND seed_key = v_country_seed;

    IF v_country IS NULL THEN
      v_country_name := public.atlas_wb_next_placeholder_name(
        p_world_profile_id, v_continent, 'country'
      );
      INSERT INTO public.world_places (
        world_profile_id, parent_place_id, kind, name, status, seed_key, sort_order
      ) VALUES (
        p_world_profile_id, v_continent, 'country', v_country_name,
        'placeholder', v_country_seed, 0
      )
      RETURNING id INTO v_country;
      v_created_places := array_append(v_created_places, v_country);

      v_country_map := public.atlas_wb_create_primary_map(
        p_world_profile_id, v_country, 'country',
        v_country_name || ' (Karte)', COALESCE(v_cont_map, v_root_map)
      );
      v_created_maps := array_append(v_created_maps, v_country_map);
      SELECT id INTO v_link FROM public.world_place_map_links
      WHERE place_id = v_country AND usage = 'primary' LIMIT 1;
      IF v_link IS NOT NULL THEN
        v_created_links := array_append(v_created_links, v_link);
      END IF;
    ELSE
      -- Ensure country still parents under continent (idempotent repair).
      UPDATE public.world_places
      SET parent_place_id = v_continent, updated_at = now()
      WHERE id = v_country
        AND parent_place_id IS DISTINCT FROM v_continent;
      SELECT map_id INTO v_country_map
      FROM public.world_place_map_links
      WHERE place_id = v_country AND usage = 'primary'
      LIMIT 1;
      IF v_country_map IS NULL THEN
        v_link := public.atlas_wb_migration_ensure_primary_link(
          p_world_profile_id, v_country
        );
        SELECT map_id INTO v_country_map
        FROM public.world_place_map_links WHERE id = v_link;
      END IF;
    END IF;

    SELECT parent_place_id INTO v_old_parent
    FROM public.world_places WHERE id = v_orphan.id;

    IF v_old_parent IS DISTINCT FROM v_country THEN
      UPDATE public.world_places
      SET parent_place_id = v_country, updated_at = now()
      WHERE id = v_orphan.id;
      v_rewrites := v_rewrites || jsonb_build_array(jsonb_build_object(
        'place_id', v_orphan.id,
        'old_parent_place_id', v_old_parent,
        'new_parent_place_id', v_country
      ));
    END IF;
  END LOOP;

  -- Primary map links for non-archived places (never invent classification).
  FOR v_place_row IN
    SELECT p.id
    FROM public.world_places p
    WHERE p.world_profile_id = p_world_profile_id
      AND p.status IS DISTINCT FROM 'archived'
      AND NOT EXISTS (
        SELECT 1 FROM public.world_place_map_links l
        WHERE l.place_id = p.id AND l.usage = 'primary'
      )
  LOOP
    v_link := public.atlas_wb_migration_ensure_primary_link(
      p_world_profile_id, v_place_row.id
    );
    IF v_link IS NOT NULL AND NOT (v_link = ANY (v_created_links)) THEN
      v_created_links := array_append(v_created_links, v_link);
    END IF;
  END LOOP;

  -- Repair parent_map_id for non-root maps that are NULL → world root.
  UPDATE public.world_atlas_maps m
  SET parent_map_id = v_root_map,
      updated_at = now()
  WHERE m.world_profile_id = p_world_profile_id
    AND m.parent_map_id IS NULL
    AND m.kind IS DISTINCT FROM 'world'
    AND m.kind IS DISTINCT FROM 'legacy_tiles';

  SELECT count(*)::int INTO v_after_places
  FROM public.world_places
  WHERE world_profile_id = p_world_profile_id;

  INSERT INTO public.atlas_wb_migration_apply_batches (
    id, world_profile_id, target, created_place_ids, created_map_ids,
    created_link_ids, parent_rewrites, notes
  ) VALUES (
    v_batch, p_world_profile_id, p_target, v_created_places, v_created_maps,
    v_created_links, v_rewrites,
    format('apply places %s→%s', v_before_places, v_after_places)
  );

  RETURN jsonb_build_object(
    'batch_id', v_batch,
    'target', p_target,
    'world_profile_id', p_world_profile_id,
    'created_place_ids', to_jsonb(v_created_places),
    'created_map_ids', to_jsonb(v_created_maps),
    'created_link_ids', to_jsonb(v_created_links),
    'parent_rewrites', v_rewrites,
    'place_count_before', v_before_places,
    'place_count_after', v_after_places
  );
END;
$$;

REVOKE ALL ON FUNCTION public.atlas_wb_migration_apply(UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atlas_wb_migration_apply(UUID, TEXT, TEXT)
  TO authenticated;

-- Rollback only additive rows from a batch (isolated clone / staging).
CREATE OR REPLACE FUNCTION public.atlas_wb_migration_rollback_batch(
  p_batch_id UUID,
  p_confirm TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.atlas_wb_migration_apply_batches%ROWTYPE;
  v_user UUID := auth.uid();
  v_owner UUID;
  v_rewrite JSONB;
  v_place_id UUID;
  v_old UUID;
  v_removed_places INT := 0;
  v_removed_maps INT := 0;
  v_removed_links INT := 0;
BEGIN
  IF p_confirm IS DISTINCT FROM 'ROLLBACK_BATCH' THEN
    RAISE EXCEPTION 'rollback confirm token required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_batch
  FROM public.atlas_wb_migration_apply_batches
  WHERE id = p_batch_id;
  IF v_batch.id IS NULL THEN
    RAISE EXCEPTION 'batch not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_batch.rolled_back_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'batch_id', p_batch_id,
      'already_rolled_back', true,
      'rolled_back_at', v_batch.rolled_back_at
    );
  END IF;

  SELECT owner_user_id INTO v_owner
  FROM public.world_profiles WHERE id = v_batch.world_profile_id;
  IF v_user IS NOT NULL AND v_user <> v_owner THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_user IS NULL
     AND current_setting('atlas.migration_operator', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Restore parent rewrites first (orphan settlements).
  FOR v_rewrite IN SELECT * FROM jsonb_array_elements(v_batch.parent_rewrites)
  LOOP
    v_place_id := (v_rewrite->>'place_id')::uuid;
    v_old := NULLIF(v_rewrite->>'old_parent_place_id', '')::uuid;
    UPDATE public.world_places
    SET parent_place_id = v_old, updated_at = now()
    WHERE id = v_place_id
      AND world_profile_id = v_batch.world_profile_id;
  END LOOP;

  -- Remove additive primary links created by this batch (maps may be shared).
  IF COALESCE(cardinality(v_batch.created_link_ids), 0) > 0 THEN
    DELETE FROM public.world_place_map_links
    WHERE id = ANY (v_batch.created_link_ids)
      AND world_profile_id = v_batch.world_profile_id;
    GET DIAGNOSTICS v_removed_links = ROW_COUNT;
  END IF;

  IF COALESCE(cardinality(v_batch.created_map_ids), 0) > 0 THEN
    DELETE FROM public.world_atlas_maps
    WHERE id = ANY (v_batch.created_map_ids)
      AND world_profile_id = v_batch.world_profile_id;
    GET DIAGNOSTICS v_removed_maps = ROW_COUNT;
  END IF;

  IF COALESCE(cardinality(v_batch.created_place_ids), 0) > 0 THEN
    DELETE FROM public.world_places
    WHERE id = ANY (v_batch.created_place_ids)
      AND world_profile_id = v_batch.world_profile_id
      AND status = 'placeholder'
      AND seed_key LIKE 'mig.ph.%';
    GET DIAGNOSTICS v_removed_places = ROW_COUNT;
  END IF;

  UPDATE public.atlas_wb_migration_apply_batches
  SET rolled_back_at = now(),
      notes = COALESCE(notes, '') || ' | rolled_back'
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'removed_places', v_removed_places,
    'removed_maps', v_removed_maps,
    'removed_links', v_removed_links,
    'restored_parent_rewrites', jsonb_array_length(v_batch.parent_rewrites)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.atlas_wb_migration_rollback_batch(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atlas_wb_migration_rollback_batch(UUID, TEXT)
  TO authenticated;

NOTIFY pgrst, 'reload schema';

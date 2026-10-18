-- #dornhain-unified-atlas — Persist Dornhain starter on Unified Canvas (not Eldoria demo).
-- Seeds world_atlas_maps.generator_meta.unifiedCanvas + places for dornhain.whisper worlds.

CREATE OR REPLACE FUNCTION public.build_dornhain_unified_generator_meta()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT $dornhain_meta${"engine":"unified_canvas","sagaSlug":"dornhain.whisper","seed":"dornhain.unified.v1","unifiedCanvas":{"format":"sagatree-unified-atlas-v1","layers":{"terrain":true,"roads":true,"region":true,"city":true,"interior":true,"drawings":true,"objects":true,"grid":false},"strokes":[{"id":"rd.market-tavern","material":"pflaster","width":22.916666666666668,"points":[[354.16666666666663,520.8333333333334],[395.8333333333333,520.8333333333334],[437.49999999999994,520.8333333333334],[437.49999999999994,479.16666666666663],[437.49999999999994,437.49999999999994],[479.16666666666663,437.49999999999994],[520.8333333333334,437.49999999999994]]},{"id":"rd.market-woods","material":"pflaster","width":22.916666666666668,"points":[[520.8333333333334,437.49999999999994],[562.5,479.16666666666663],[604.1666666666666,520.8333333333334],[645.8333333333334,562.5],[687.5,604.1666666666666]]}],"objects":[{"id":"obj.loc.tavern","type":"haus","x":354.16666666666663,"y":520.8333333333334,"size":2.4,"height":18},{"id":"obj.loc.market","type":"haus","x":520.8333333333334,"y":437.49999999999994,"size":2.2,"height":18},{"id":"obj.loc.woods","type":"tanne","x":687.5,"y":604.1666666666666,"size":2.8},{"id":"obj.loc.crypt","type":"fels","x":770.8333333333334,"y":354.16666666666663,"size":2.6},{"id":"obj.loc.bandit-camp","type":"turm","x":854.1666666666666,"y":687.5,"size":2,"height":18},{"id":"obj.tree-a","type":"baum","x":604.1666666666666,"y":270.8333333333333,"size":1.8},{"id":"obj.tree-b","type":"tanne","x":812.5,"y":520.8333333333334,"size":2.1},{"id":"obj.tree-c","type":"baum","x":270.8333333333333,"y":354.16666666666663,"size":1.6}],"rooms":[{"id":"r.grass","material":"gras","x":0,"y":0,"w":1000,"h":1000},{"id":"r.water-w","material":"wasser","x":0,"y":0,"w":125,"h":1000},{"id":"r.water-sw","material":"wasser","x":125,"y":750,"w":83.33333333333333,"h":250},{"id":"r.mount-n","material":"stein","x":0,"y":0,"w":1000,"h":125},{"id":"r.mount-ne","material":"stein","x":666.6666666666666,"y":125,"w":333.3333333333333,"h":83.33333333333333},{"id":"r.forest-e","material":"holz","x":791.6666666666666,"y":0,"w":208.33333333333331,"h":1000},{"id":"r.forest-mid","material":"holz","x":708.3333333333333,"y":416.66666666666663,"w":83.33333333333333,"h":375},{"id":"r.city-tavern","material":"pflaster","x":291.66666666666663,"y":458.3333333333333,"w":125,"h":125},{"id":"r.city-market","material":"pflaster","x":458.3333333333333,"y":375,"w":125,"h":125},{"id":"r.city-woods","material":"erde","x":625,"y":541.6666666666666,"w":125,"h":125},{"id":"r.city-crypt","material":"stein","x":708.3333333333333,"y":291.66666666666663,"w":125,"h":125}],"walls":[],"demoSeed":false}}$dornhain_meta$::jsonb;
$fn$;

REVOKE ALL ON FUNCTION public.build_dornhain_unified_generator_meta() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_dornhain_unified_generator_meta() TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.seed_dornhain_unified_atlas(p_world_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_root UUID;
  v_settlement UUID;
  v_dornhain UUID;
  v_meta JSONB := public.build_dornhain_unified_generator_meta();
BEGIN
  IF p_world_profile_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_root
  FROM public.world_atlas_maps
  WHERE world_profile_id = p_world_profile_id AND kind = 'world'
  ORDER BY sort_order, created_at
  LIMIT 1;

  IF v_root IS NULL THEN
    INSERT INTO public.world_atlas_maps (
      world_profile_id, parent_map_id, kind, title, sort_order, bounds, generator_meta
    ) VALUES (
      p_world_profile_id, NULL, 'world', 'Dornhain Übersicht (Unified)', 10,
      '{"minX":0,"minY":0,"maxX":1000,"maxY":1000}'::jsonb,
      v_meta
    )
    RETURNING id INTO v_root;
  ELSE
    UPDATE public.world_atlas_maps
    SET
      title = CASE
        WHEN title IN ('Weltkarte (Unified)', 'Kachelkarte (Legacy)')
          OR btrim(title) = '' THEN 'Dornhain Übersicht (Unified)'
        ELSE title
      END,
      generator_meta = CASE
        -- Fill empty / demo-less canvas; keep user drawings (demoSeed=false with strokes).
        WHEN COALESCE(generator_meta->'unifiedCanvas'->>'demoSeed', 'true') = 'true'
             AND COALESCE(jsonb_array_length(generator_meta->'unifiedCanvas'->'strokes'), 0) = 0
             AND COALESCE(jsonb_array_length(generator_meta->'unifiedCanvas'->'objects'), 0) = 0
          THEN v_meta
        WHEN generator_meta->'unifiedCanvas' IS NULL
          THEN v_meta
        WHEN COALESCE(generator_meta->>'seed', '') = 'dornhain.unified.v1'
          THEN v_meta
        ELSE generator_meta
      END,
      updated_at = NOW()
    WHERE id = v_root;
  END IF;

  -- Places hierarchy (idempotent)
  INSERT INTO public.world_places (world_profile_id, parent_place_id, kind, name, description, status, seed_key, sort_order)
  VALUES (p_world_profile_id, NULL, 'settlement', 'Dornhain', 'Stadt in Donalu — Starterschauplatz', 'canonical', 'place.dornhain', 10)
  ON CONFLICT (world_profile_id, seed_key) DO UPDATE
    SET name = EXCLUDED.name, kind = EXCLUDED.kind, status = EXCLUDED.status, description = EXCLUDED.description;
  SELECT id INTO v_dornhain FROM public.world_places
  WHERE world_profile_id = p_world_profile_id AND seed_key = 'place.dornhain';

  INSERT INTO public.world_places (world_profile_id, parent_place_id, kind, name, description, status, seed_key, sort_order)
  VALUES
    (p_world_profile_id, v_dornhain, 'building', 'Taverne Zum Flüstern', 'Treffpunkt der Helden', 'canonical', 'loc.tavern', 20),
    (p_world_profile_id, v_dornhain, 'site', 'Marktplatz Dornhain', 'Gerüchte und Handel', 'canonical', 'loc.market', 30),
    (p_world_profile_id, v_dornhain, 'area', 'Schattenwald', 'Wald vor den Toren', 'canonical', 'loc.woods', 40),
    (p_world_profile_id, v_dornhain, 'dungeon', 'Krypta unter dem Hügel', 'GM-only Reliktort', 'canonical', 'loc.crypt', 50),
    (p_world_profile_id, v_dornhain, 'site', 'Banditenlager (falsche Spur)', 'Ablenkung', 'canonical', 'loc.bandit-camp', 60)
  ON CONFLICT (world_profile_id, seed_key) DO UPDATE SET
    parent_place_id = COALESCE(EXCLUDED.parent_place_id, public.world_places.parent_place_id),
    name = EXCLUDED.name,
    kind = EXCLUDED.kind,
    description = COALESCE(EXCLUDED.description, public.world_places.description),
    status = EXCLUDED.status;

  -- Settlement detail map under world root
  SELECT id INTO v_settlement
  FROM public.world_atlas_maps
  WHERE world_profile_id = p_world_profile_id
    AND kind = 'settlement'
    AND (title ILIKE '%Dornhain%' OR generator_meta->>'placeSeedKey' = 'place.dornhain')
  ORDER BY sort_order
  LIMIT 1;

  IF v_settlement IS NULL THEN
    INSERT INTO public.world_atlas_maps (
      world_profile_id, parent_map_id, kind, title, sort_order, bounds, generator_meta
    ) VALUES (
      p_world_profile_id, v_root, 'settlement', 'Dornhain (Stadt)', 20,
      '{"minX":0,"minY":0,"maxX":400,"maxY":400}'::jsonb,
      jsonb_build_object(
        'engine', 'unified_canvas',
        'placeSeedKey', 'place.dornhain',
        'unifiedCanvas', jsonb_build_object(
          'format', 'sagatree-unified-atlas-v1',
          'demoSeed', false,
          'layers', jsonb_build_object(
            'terrain', true, 'roads', true, 'region', true, 'city', true,
            'interior', true, 'drawings', true, 'objects', true, 'grid', false
          ),
          'strokes', '[]'::jsonb,
          'objects', jsonb_build_array(
            jsonb_build_object('id', 'city.tavern', 'type', 'haus', 'x', 120, 'y', 200, 'size', 3.2, 'height', 22),
            jsonb_build_object('id', 'city.market', 'type', 'haus', 'x', 220, 'y', 160, 'size', 3.0, 'height', 18),
            jsonb_build_object('id', 'city.tree', 'type', 'baum', 'x', 300, 'y', 260, 'size', 2.0)
          ),
          'rooms', jsonb_build_array(
            jsonb_build_object('id', 'city.ground', 'material', 'gras', 'x', 0, 'y', 0, 'w', 400, 'h', 400),
            jsonb_build_object('id', 'city.plaza', 'material', 'pflaster', 'x', 80, 'y', 120, 'w', 200, 'h', 160)
          ),
          'walls', '[]'::jsonb
        )
      )
    )
    RETURNING id INTO v_settlement;
  END IF;

  -- Link places to maps when link table exists
  IF to_regclass('public.world_place_map_links') IS NOT NULL AND v_settlement IS NOT NULL THEN
    INSERT INTO public.world_place_map_links (world_profile_id, place_id, map_id, usage)
    SELECT p_world_profile_id, p.id, v_root, 'overview'
    FROM public.world_places p
    WHERE p.world_profile_id = p_world_profile_id AND p.seed_key = 'place.dornhain'
    ON CONFLICT (place_id, map_id, usage) DO NOTHING;

    INSERT INTO public.world_place_map_links (world_profile_id, place_id, map_id, usage)
    SELECT p_world_profile_id, p.id, v_settlement, 'footprint'
    FROM public.world_places p
    WHERE p.world_profile_id = p_world_profile_id AND p.seed_key = 'place.dornhain'
    ON CONFLICT (place_id, map_id, usage) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_dornhain_unified_atlas(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_dornhain_unified_atlas(UUID) TO service_role;

-- Patch catalog seed to also write Unified Atlas.
CREATE OR REPLACE FUNCTION public.seed_dornhain_catalog_bindings(p_project_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted INT := 0;
  v_world UUID;
  r RECORD;
  v_map JSONB;
BEGIN
  IF p_project_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT world_profile_id INTO v_world FROM public.projects WHERE id = p_project_id;

  FOR r IN
    SELECT * FROM (VALUES
      ('pregen.warrior', 'Brenna Sturmfaust', 'party'),
      ('pregen.scout', 'Kael Schattenpfad', 'party'),
      ('pregen.mystic', 'Liora Mondschein', 'party'),
      ('pregen.diplomat', 'Oskar Federkiel', 'party')
    ) AS t(asset_id, label, reveal)
  LOOP
    INSERT INTO public.saga_asset_bindings (
      project_id, asset_kind, asset_id, reveal, label, metadata
    ) VALUES (
      p_project_id, 'character', r.asset_id, r.reveal, r.label,
      jsonb_build_object('origin', 'native', 'immutable', true)
    )
    ON CONFLICT (project_id, asset_kind, asset_id) DO UPDATE SET
      label = EXCLUDED.label,
      reveal = EXCLUDED.reveal,
      metadata = public.saga_asset_bindings.metadata || EXCLUDED.metadata,
      updated_at = NOW();
    v_inserted := v_inserted + 1;
  END LOOP;

  FOR r IN
    SELECT * FROM (VALUES
      ('loc.tavern', 'Taverne Zum Flüstern', 'party'),
      ('loc.market', 'Marktplatz Dornhain', 'party'),
      ('loc.woods', 'Schattenwald', 'party'),
      ('loc.crypt', 'Krypta unter dem Hügel', 'gm_only'),
      ('loc.bandit-camp', 'Banditenlager (falsche Spur)', 'gm_only')
    ) AS t(asset_id, label, reveal)
  LOOP
    INSERT INTO public.saga_asset_bindings (
      project_id, asset_kind, asset_id, reveal, label, metadata
    ) VALUES (
      p_project_id, 'location', r.asset_id, r.reveal, r.label,
      jsonb_build_object('origin', 'native', 'immutable', true)
    )
    ON CONFLICT (project_id, asset_kind, asset_id) DO UPDATE SET
      label = EXCLUDED.label,
      reveal = EXCLUDED.reveal,
      metadata = public.saga_asset_bindings.metadata || EXCLUDED.metadata,
      updated_at = NOW();
    v_inserted := v_inserted + 1;
  END LOOP;

  FOR r IN
    SELECT * FROM (VALUES
      ('npc.innkeeper', 'Wirtin Maren', 'party'),
      ('npc.guard', 'Stadtwache Bren', 'party'),
      ('npc.bandit-a', 'Bandit Rusk', 'party'),
      ('npc.bandit-b', 'Banditin Syla', 'gm_only'),
      ('npc.hidden-villager', 'Dorfbewohner (Relikt)', 'gm_only')
    ) AS t(asset_id, label, reveal)
  LOOP
    INSERT INTO public.saga_asset_bindings (
      project_id, asset_kind, asset_id, reveal, label, metadata
    ) VALUES (
      p_project_id, 'npc', r.asset_id, r.reveal, r.label,
      jsonb_build_object('origin', 'native', 'immutable', true)
    )
    ON CONFLICT (project_id, asset_kind, asset_id) DO UPDATE SET
      label = EXCLUDED.label,
      reveal = EXCLUDED.reveal,
      metadata = public.saga_asset_bindings.metadata || EXCLUDED.metadata,
      updated_at = NOW();
    v_inserted := v_inserted + 1;
  END LOOP;

  FOR r IN
    SELECT * FROM (VALUES
      ('quest.missing-villagers', 'Die Verschwundenen', 'party'),
      ('quest.false-bandits', 'Falsche Spur: Banditen', 'party'),
      ('quest.relic-seal', 'Das Relikt versiegeln', 'gm_only')
    ) AS t(asset_id, label, reveal)
  LOOP
    INSERT INTO public.saga_asset_bindings (
      project_id, asset_kind, asset_id, reveal, label, metadata
    ) VALUES (
      p_project_id, 'quest', r.asset_id, r.reveal, r.label,
      jsonb_build_object('origin', 'native', 'immutable', true)
    )
    ON CONFLICT (project_id, asset_kind, asset_id) DO UPDATE SET
      label = EXCLUDED.label,
      reveal = EXCLUDED.reveal,
      metadata = public.saga_asset_bindings.metadata || EXCLUDED.metadata,
      updated_at = NOW();
    v_inserted := v_inserted + 1;
  END LOOP;

  FOR r IN
    SELECT * FROM (VALUES
      ('builtin.fantasy.healing-potion', 'Heiltrank', 'party'),
      ('builtin.fantasy.longsword', 'Langschwert', 'party'),
      ('builtin.fantasy.gemstone', 'Siegelstein', 'party'),
      ('item.relic-shard', 'Reliktsplitter', 'gm_only')
    ) AS t(asset_id, label, reveal)
  LOOP
    INSERT INTO public.saga_asset_bindings (
      project_id, asset_kind, asset_id, reveal, label, metadata
    ) VALUES (
      p_project_id, 'item', r.asset_id, r.reveal, r.label,
      jsonb_build_object('origin', 'native', 'immutable', true)
    )
    ON CONFLICT (project_id, asset_kind, asset_id) DO UPDATE SET
      label = EXCLUDED.label,
      reveal = EXCLUDED.reveal,
      metadata = public.saga_asset_bindings.metadata || EXCLUDED.metadata,
      updated_at = NOW();
    v_inserted := v_inserted + 1;
  END LOOP;

  FOR r IN
    SELECT * FROM (VALUES
      ('lore.market-rumors', 'Gerüchte am Markt', 'party', 'Am Markt flüstert man von Verschwundenen.'),
      ('lore.whisper-legend', 'Legende vom Flüstern', 'party', 'Unter dem Hügel soll etwas flüstern.'),
      ('lore.relic-truth', 'Wahrheit des Relikts', 'gm_only', '')
    ) AS t(asset_id, label, reveal, summary)
  LOOP
    INSERT INTO public.saga_asset_bindings (
      project_id, asset_kind, asset_id, reveal, label, metadata
    ) VALUES (
      p_project_id, 'lore', r.asset_id, r.reveal, r.label,
      jsonb_build_object(
        'origin', 'native',
        'immutable', true,
        'summary', r.summary
      )
    )
    ON CONFLICT (project_id, asset_kind, asset_id) DO UPDATE SET
      label = EXCLUDED.label,
      reveal = EXCLUDED.reveal,
      metadata = public.saga_asset_bindings.metadata || EXCLUDED.metadata,
      updated_at = NOW();
    v_inserted := v_inserted + 1;
  END LOOP;

  INSERT INTO public.saga_asset_bindings (
    project_id, asset_kind, asset_id, reveal, label, metadata
  ) VALUES (
    p_project_id, 'map', 'map.dornhain.overview', 'party', 'Dornhain Übersichtskarte',
    jsonb_build_object('origin', 'native', 'immutable', true, 'atlas', 'unified')
  )
  ON CONFLICT (project_id, asset_kind, asset_id) DO UPDATE SET
    label = EXCLUDED.label,
    reveal = EXCLUDED.reveal,
    metadata = public.saga_asset_bindings.metadata || EXCLUDED.metadata,
    updated_at = NOW();
  v_inserted := v_inserted + 1;

  IF v_world IS NOT NULL THEN
    v_map := public.build_dornhain_starter_map_data(24);
    INSERT INTO public.world_maps (world_profile_id, revision, map_data, updated_at)
    VALUES (v_world, 1, v_map, NOW())
    ON CONFLICT (world_profile_id) DO UPDATE SET
      map_data = CASE
        WHEN COALESCE(public.world_maps.map_data->'tiles', '{}'::jsonb) = '{}'::jsonb
          OR COALESCE(jsonb_typeof(public.world_maps.map_data->'pins'->0->'title'), 'null') = 'null'
          THEN EXCLUDED.map_data
        ELSE public.world_maps.map_data
      END,
      updated_at = NOW();

    PERFORM public.seed_dornhain_unified_atlas(v_world);
  END IF;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_dornhain_catalog_bindings(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_dornhain_catalog_bindings(UUID) TO service_role;

-- Backfill: every Dornhain whisper world + Donalu WO-9FFK6
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT wp.id AS world_id
    FROM public.world_profiles wp
    WHERE wp.public_id = 'WO-9FFK6'
       OR wp.name IN ('Dornhain', 'Donalu')
       OR COALESCE(wp.modules->>'sagaSlug', '') = 'dornhain.whisper'
       OR EXISTS (
         SELECT 1 FROM public.projects p
         JOIN public.saga_definitions d ON d.id = p.saga_id
         WHERE p.world_profile_id = wp.id AND d.slug = 'dornhain.whisper'
       )
  LOOP
    PERFORM public.seed_dornhain_unified_atlas(r.world_id);
  END LOOP;
END;
$$;

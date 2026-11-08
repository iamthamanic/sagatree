-- #saga-world-atlas — Dornhain always has linked world + visible basic terrain map.
-- Fixes pin title field (was `label`, parser expects `title`) and paints starter biomes.

CREATE OR REPLACE FUNCTION public.build_dornhain_starter_map_data(p_size INT DEFAULT 24)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  n INT := GREATEST(16, LEAST(COALESCE(p_size, 24), 40));
  v_tiles JSONB := '{}'::jsonb;
  v_x INT;
  v_y INT;
  v_type TEXT;
  v_key TEXT;
BEGIN
  FOR v_y IN 0 .. (n - 1) LOOP
    FOR v_x IN 0 .. (n - 1) LOOP
      v_type := 'grass';
      IF v_x <= 2 OR (v_x <= 4 AND v_y >= n - 6) THEN
        v_type := 'water';
      ELSIF v_y <= 2 OR (v_y <= 4 AND v_x >= n - 8) THEN
        v_type := 'mountain';
      ELSIF v_x >= n - 5 OR (v_x >= n - 7 AND v_y >= 10 AND v_y <= 18) THEN
        v_type := 'forest';
      END IF;
      -- roads market↔tavern↔woods
      IF (v_y = 11 AND v_x BETWEEN 8 AND 12)
         OR (v_x = 10 AND v_y BETWEEN 10 AND 12)
         OR (v_y = 12 AND v_x BETWEEN 12 AND 16) THEN
        v_type := 'road';
      END IF;
      IF (v_x = 8 AND v_y = 12)
         OR (v_x = 12 AND v_y = 10)
         OR (v_x = 16 AND v_y = 14)
         OR (v_x = 18 AND v_y = 8) THEN
        v_type := 'city';
      END IF;
      v_key := v_x::text || ',' || v_y::text;
      v_tiles := jsonb_set(
        v_tiles,
        ARRAY[v_key],
        jsonb_build_object('type', v_type, 'countryId', NULL),
        true
      );
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'size', n,
    'tiles', v_tiles,
    'countries', '[]'::jsonb,
    'pins', jsonb_build_array(
      jsonb_build_object('id', 'pin.tavern', 'title', 'Taverne', 'x', 8, 'y', 12, 'discovered', true, 'locationRef', 'loc.tavern'),
      jsonb_build_object('id', 'pin.market', 'title', 'Markt', 'x', 12, 'y', 10, 'discovered', true, 'locationRef', 'loc.market'),
      jsonb_build_object('id', 'pin.woods', 'title', 'Wald', 'x', 16, 'y', 14, 'discovered', true, 'locationRef', 'loc.woods'),
      jsonb_build_object('id', 'pin.crypt', 'title', 'Krypta', 'x', 18, 'y', 8, 'discovered', false, 'locationRef', 'loc.crypt')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.build_dornhain_starter_map_data(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_dornhain_starter_map_data(INT) TO service_role;

-- Patch catalog seed: always upsert Dornhain starter map terrain (pins + tiles).
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

  INSERT INTO public.saga_asset_bindings (
    project_id, asset_kind, asset_id, reveal, label, metadata
  ) VALUES (
    p_project_id, 'map', 'map.dornhain.overview', 'party', 'Dornhain Übersichtskarte',
    jsonb_build_object('origin', 'native', 'immutable', true, 'worldProfileId', v_world)
  )
  ON CONFLICT (project_id, asset_kind, asset_id) DO UPDATE SET
    label = EXCLUDED.label,
    reveal = EXCLUDED.reveal,
    metadata = public.saga_asset_bindings.metadata || EXCLUDED.metadata,
    updated_at = NOW();
  v_inserted := v_inserted + 1;

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
      ('builtin.fantasy.gemstone', 'Siegelstein', 'party'),
      ('builtin.fantasy.healing-potion', 'Heiltrank', 'party'),
      ('builtin.fantasy.longsword', 'Langschwert', 'party'),
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
      ('lore.whisper-legend', 'Legende vom Flüstern', 'party',
       'Alte Geschichten sprechen von einem Flüstern unter dem Hügel.'),
      ('lore.market-rumors', 'Gerüchte am Markt', 'party',
       'Am Marktplatz tuscheln die Leute über die Verschwundenen.'),
      ('lore.relic-truth', 'Wahrheit des Relikts', 'gm_only',
       'Das Relikt wurde geöffnet; die Gefahr wächst mit der Zeit.')
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

  IF v_world IS NOT NULL THEN
    v_map := public.build_dornhain_starter_map_data(24);
    INSERT INTO public.world_maps (world_profile_id, revision, map_data, updated_at)
    VALUES (v_world, 1, v_map, NOW())
    ON CONFLICT (world_profile_id) DO UPDATE SET
      map_data = CASE
        -- Replace empty / pin-only / label-only legacy seeds with full starter terrain.
        WHEN COALESCE(public.world_maps.map_data->'tiles', '{}'::jsonb) = '{}'::jsonb
          OR COALESCE(jsonb_typeof(public.world_maps.map_data->'pins'->0->'title'), 'null') = 'null'
          THEN EXCLUDED.map_data
        ELSE public.world_maps.map_data
      END,
      updated_at = NOW();
  END IF;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_dornhain_catalog_bindings(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_dornhain_catalog_bindings(UUID) TO service_role;

-- One-shot: ensure every Dornhain playthrough has world_profile_id + starter map.
DO $$
DECLARE
  r RECORD;
  v_world UUID;
BEGIN
  FOR r IN
    SELECT p.id AS project_id, p.gm_user_id, p.world_profile_id
    FROM public.projects p
    JOIN public.saga_definitions d ON d.id = p.saga_id
    WHERE d.slug = 'dornhain.whisper'
  LOOP
    v_world := r.world_profile_id;
    IF v_world IS NULL AND r.gm_user_id IS NOT NULL THEN
      SELECT wp.id INTO v_world
      FROM public.world_profiles wp
      WHERE wp.owner_user_id = r.gm_user_id
        AND wp.name = 'Dornhain'
      ORDER BY wp.created_at ASC
      LIMIT 1;
      IF v_world IS NULL THEN
        INSERT INTO public.world_profiles (owner_user_id, name, description, modules)
        VALUES (
          r.gm_user_id,
          'Dornhain',
          'Starterwelt zum Abenteuer Das Flüstern unter Dornhain',
          jsonb_build_object('origin', 'native', 'sagaSlug', 'dornhain.whisper')
        )
        RETURNING id INTO v_world;
      END IF;
      UPDATE public.projects
      SET world_profile_id = v_world, updated_at = NOW()
      WHERE id = r.project_id;
    END IF;
    PERFORM public.seed_dornhain_catalog_bindings(r.project_id);
  END LOOP;
END;
$$;

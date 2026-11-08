-- #618 Phase 3 — Dornhain full catalog bindings + starter world map (idempotent).
-- Seeds saga_asset_bindings for projects linked to native dornhain.whisper.
-- Reveal mix: starter party assets party; spoilers gm_only.

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
BEGIN
  IF p_project_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT world_profile_id INTO v_world FROM public.projects WHERE id = p_project_id;

  -- Characters (pregens) — party
  FOR r IN
    SELECT * FROM (VALUES
      ('pregen.warrior', 'Kriegerin Mira', 'party'),
      ('pregen.scout', 'Späher Toren', 'party'),
      ('pregen.mystic', 'Mystikerin Elara', 'party'),
      ('pregen.diplomat', 'Diplomat Kai', 'party')
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

  -- Locations — starter party, crypt/bandit spoilers gm_only
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

  -- Map shell
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

  -- NPCs
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

  -- Items
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

  -- Quests
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

  -- Lore bindings (party-safe + hidden)
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

  -- Starter world map pins for overview (if world profile present)
  IF v_world IS NOT NULL THEN
    INSERT INTO public.world_maps (world_profile_id, revision, map_data, updated_at)
    VALUES (
      v_world,
      1,
      jsonb_build_object(
        'size', 24,
        'tiles', '{}'::jsonb,
        'countries', '[]'::jsonb,
        'pins', jsonb_build_array(
          jsonb_build_object('id', 'pin.tavern', 'label', 'Taverne', 'x', 8, 'y', 12, 'discovered', true, 'locationRef', 'loc.tavern'),
          jsonb_build_object('id', 'pin.market', 'label', 'Markt', 'x', 12, 'y', 10, 'discovered', true, 'locationRef', 'loc.market'),
          jsonb_build_object('id', 'pin.woods', 'label', 'Wald', 'x', 16, 'y', 14, 'discovered', true, 'locationRef', 'loc.woods'),
          jsonb_build_object('id', 'pin.crypt', 'label', 'Krypta', 'x', 18, 'y', 8, 'discovered', false, 'locationRef', 'loc.crypt')
        )
      ),
      NOW()
    )
    ON CONFLICT (world_profile_id) DO UPDATE SET
      map_data = CASE
        WHEN COALESCE(public.world_maps.map_data->'pins', '[]'::jsonb) = '[]'::jsonb
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

COMMENT ON FUNCTION public.seed_dornhain_catalog_bindings(UUID) IS
  '#618 Idempotent Dornhain catalog bindings + starter map pins for a project.';

-- Backfill all Dornhain-linked projects
DO $$
DECLARE
  v_saga UUID;
  p RECORD;
BEGIN
  SELECT id INTO v_saga FROM public.saga_definitions WHERE slug = 'dornhain.whisper' LIMIT 1;
  IF v_saga IS NULL THEN
    RAISE NOTICE 'dornhain.whisper missing — skip catalog seed';
    RETURN;
  END IF;

  FOR p IN
    SELECT id FROM public.projects WHERE saga_id = v_saga
  LOOP
    PERFORM public.seed_dornhain_catalog_bindings(p.id);
  END LOOP;
END;
$$;

-- Hook: when ensure_native_starter creates/finds a project, seed catalog.
CREATE OR REPLACE FUNCTION public.ensure_native_starter_project(
  p_slug TEXT DEFAULT 'dornhain.whisper'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  v_def public.saga_definitions%ROWTYPE;
  v_ver public.saga_definition_versions%ROWTYPE;
  existing public.projects%ROWTYPE;
  created public.projects%ROWTYPE;
  v_out JSONB;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_def
  FROM public.saga_definitions
  WHERE slug = BTRIM(COALESCE(p_slug, ''))
    AND origin = 'native';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Native Saga nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  SELECT v.* INTO v_ver
  FROM public.saga_definition_versions v
  WHERE v.saga_id = v_def.id
    AND v.status = 'published'
  ORDER BY v.published_at DESC NULLS LAST
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Keine veröffentlichte Fassung' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.* INTO existing
  FROM public.projects p
  WHERE p.gm_user_id = actor
    AND p.saga_id = v_def.id
    AND p.status IN ('active', 'paused')
  ORDER BY p.created_at ASC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    IF v_def.slug = 'dornhain.whisper' THEN
      PERFORM public.seed_dornhain_catalog_bindings(existing.id);
    END IF;
    RETURN jsonb_build_object(
      'id', existing.id,
      'public_id', existing.public_id,
      'created', false,
      'name', existing.name,
      'saga_id', v_def.id,
      'saga_version_id', COALESCE(existing.saga_version_id, v_ver.id)
    );
  END IF;

  created := public.create_project_from_saga_version(v_def.id, v_ver.id, v_def.title);

  IF v_def.slug = 'dornhain.whisper' THEN
    PERFORM public.seed_dornhain_catalog_bindings(created.id);
  END IF;

  RETURN jsonb_build_object(
    'id', created.id,
    'public_id', created.public_id,
    'created', true,
    'name', created.name,
    'saga_id', v_def.id,
    'saga_version_id', v_ver.id
  );
END;
$$;

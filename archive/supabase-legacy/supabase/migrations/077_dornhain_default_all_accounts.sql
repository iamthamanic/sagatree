-- #dornhain-default-all-accounts — Provision Dornhain starter (project + catalog +
-- world + pregen characters + GM grants) for every auth user, including signup.

-- ---------------------------------------------------------------------------
-- Align catalog character labels with prepared-adventure fixture names.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- GM saga bundle for a project member (idempotent).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_member_saga_gm_bundle(p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project UUID;
  v_user UUID;
BEGIN
  IF p_member_id IS NULL THEN
    RETURN;
  END IF;

  SELECT project_id, user_id INTO v_project, v_user
  FROM public.project_members
  WHERE id = p_member_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN;
  END IF;

  DELETE FROM public.project_member_saga_grants WHERE member_id = p_member_id;
  INSERT INTO public.project_member_saga_grants (
    project_id, member_id, user_id, permission_key, source_bundle_id, granted_by
  )
  SELECT v_project, p_member_id, v_user, bk.permission_key, 'bundle.saga.gm', NULL
  FROM public.saga_permission_bundle_keys bk
  WHERE bk.bundle_id = 'bundle.saga.gm';

  INSERT INTO public.project_member_saga_bundles (
    member_id, project_id, user_id, bundle_id, assigned_by, updated_at
  ) VALUES (
    p_member_id, v_project, v_user, 'bundle.saga.gm', NULL, NOW()
  )
  ON CONFLICT (member_id) DO UPDATE SET
    bundle_id = 'bundle.saga.gm',
    updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_member_saga_gm_bundle(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_member_saga_gm_bundle(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- Pregen library characters + inventory for a Dornhain project GM.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_dornhain_starter_characters(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT := 0;
  r RECORD;
BEGIN
  IF p_project_id IS NULL OR p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      (
        'pregen.warrior',
        'Brenna Sturmfaust',
        'Kämpferin',
        2,
        '{"strength":4,"dexterity":3,"endurance":3,"mind":1,"perception":2,"charisma":2,"nativeAssetId":"pregen.warrior"}'::jsonb,
        '["builtin.fantasy.healing-potion","builtin.fantasy.longsword","builtin.fantasy.rope"]'::jsonb
      ),
      (
        'pregen.scout',
        'Kael Schattenpfad',
        'Späher',
        2,
        '{"strength":2,"dexterity":4,"endurance":2,"mind":2,"perception":4,"charisma":2,"nativeAssetId":"pregen.scout"}'::jsonb,
        '["builtin.fantasy.healing-potion","builtin.fantasy.shortbow","builtin.fantasy.lockpicks"]'::jsonb
      ),
      (
        'pregen.mystic',
        'Liora Mondschein',
        'Mystikerin',
        2,
        '{"strength":1,"dexterity":2,"endurance":2,"mind":4,"perception":3,"charisma":3,"nativeAssetId":"pregen.mystic"}'::jsonb,
        '["builtin.fantasy.healing-potion","builtin.fantasy.quarterstaff","builtin.fantasy.healer-kit"]'::jsonb
      ),
      (
        'pregen.diplomat',
        'Oskar Federkiel',
        'Diplomat',
        2,
        '{"strength":1,"dexterity":2,"endurance":2,"mind":3,"perception":3,"charisma":4,"nativeAssetId":"pregen.diplomat"}'::jsonb,
        '["builtin.fantasy.healing-potion","builtin.fantasy.dagger","builtin.fantasy.writing-kit"]'::jsonb
      )
    ) AS t(asset_id, char_name, class_label, lvl, attrs, inv)
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.owner_user_id = p_user_id
        AND (
          c.attributes->>'nativeAssetId' = r.asset_id
          OR (c.project_id = p_project_id AND c.name = r.char_name)
          OR (c.project_id IS NULL AND c.name = r.char_name)
        )
    ) THEN
      UPDATE public.characters c
      SET
        project_id = COALESCE(c.project_id, p_project_id),
        class = COALESCE(NULLIF(BTRIM(c.class), ''), r.class_label),
        race = COALESCE(NULLIF(BTRIM(c.race), ''), 'Mensch'),
        level = COALESCE(c.level, r.lvl),
        attributes = COALESCE(c.attributes, '{}'::jsonb) || r.attrs,
        skills = COALESCE(c.skills, '{}'::jsonb),
        sagadrive_profile = COALESCE(
          c.sagadrive_profile,
          jsonb_build_object(
            'origin', 'native',
            'nativeAssetId', r.asset_id,
            'starter', true
          )
        ),
        inventory = CASE
          WHEN jsonb_typeof(c.inventory) = 'array' AND jsonb_array_length(c.inventory) > 0
            THEN c.inventory
          ELSE r.inv
        END,
        description = COALESCE(
          NULLIF(BTRIM(c.description), ''),
          'Dornhain-Starter · ' || r.class_label
        ),
        updated_at = NOW()
      WHERE c.owner_user_id = p_user_id
        AND (
          c.attributes->>'nativeAssetId' = r.asset_id
          OR (c.project_id = p_project_id AND c.name = r.char_name)
          OR (c.project_id IS NULL AND c.name = r.char_name)
        );
    ELSE
      INSERT INTO public.characters (
        owner_user_id, project_id, name, description, class, race, level,
        attributes, skills, inventory, character_type, sheet_status,
        sagadrive_profile
      ) VALUES (
        p_user_id,
        p_project_id,
        r.char_name,
        'Dornhain-Starter · ' || r.class_label,
        r.class_label,
        'Mensch',
        r.lvl,
        r.attrs,
        '{}'::jsonb,
        r.inv,
        'pc',
        'complete',
        jsonb_build_object(
          'origin', 'native',
          'nativeAssetId', r.asset_id,
          'starter', true
        )
      );
    END IF;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_dornhain_starter_characters(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_dornhain_starter_characters(UUID, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- Provision full Dornhain default for one user (no auth.uid required).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_dornhain_starter_for_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_def public.saga_definitions%ROWTYPE;
  v_ver public.saga_definition_versions%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_world UUID;
  v_member UUID;
  v_created BOOLEAN := false;
  v_adv JSONB := '{}'::jsonb;
  v_bindings INT := 0;
  v_chars INT := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
  END IF;

  -- So world_profile binding triggers (auth.uid()) pass during service backfill.
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );

  SELECT * INTO v_def
  FROM public.saga_definitions
  WHERE slug = 'dornhain.whisper' AND origin = 'native';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'saga_missing');
  END IF;

  SELECT v.* INTO v_ver
  FROM public.saga_definition_versions v
  WHERE v.saga_id = v_def.id AND v.status = 'published'
  ORDER BY v.published_at DESC NULLS LAST
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'version_missing');
  END IF;

  SELECT p.* INTO v_project
  FROM public.projects p
  WHERE p.gm_user_id = p_user_id
    AND p.saga_id = v_def.id
    AND p.status IN ('active', 'paused')
  ORDER BY p.created_at ASC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    IF jsonb_typeof(v_ver.payload->'initialAdventure') = 'object' THEN
      v_adv := v_ver.payload->'initialAdventure';
    END IF;

    INSERT INTO public.projects (
      code, name, description, gm_user_id, status,
      saga_id, saga_version_id, adventure_runtime
    ) VALUES (
      NULL,
      v_def.title,
      v_def.synopsis,
      p_user_id,
      'active',
      v_def.id,
      v_ver.id,
      v_adv
    )
    RETURNING * INTO v_project;
    v_created := true;
  END IF;

  -- World profile bound to this playthrough
  IF v_project.world_profile_id IS NULL THEN
    SELECT wp.id INTO v_world
    FROM public.world_profiles wp
    WHERE wp.owner_user_id = p_user_id
      AND wp.name = 'Dornhain'
    ORDER BY wp.created_at ASC
    LIMIT 1;

    IF v_world IS NULL THEN
      INSERT INTO public.world_profiles (owner_user_id, name, description, modules)
      VALUES (
        p_user_id,
        'Dornhain',
        'Starterwelt zum Abenteuer Das Flüstern unter Dornhain',
        jsonb_build_object('origin', 'native', 'sagaSlug', 'dornhain.whisper')
      )
      RETURNING id INTO v_world;
    END IF;

    UPDATE public.projects
    SET world_profile_id = v_world, updated_at = NOW()
    WHERE id = v_project.id;
    v_project.world_profile_id := v_world;
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role, status)
  VALUES (v_project.id, p_user_id, 'gm', 'active')
  ON CONFLICT (project_id, user_id) DO UPDATE SET
    role = 'gm',
    status = 'active'
  RETURNING id INTO v_member;

  IF v_member IS NULL THEN
    SELECT id INTO v_member
    FROM public.project_members
    WHERE project_id = v_project.id AND user_id = p_user_id;
  END IF;

  PERFORM public.ensure_member_saga_gm_bundle(v_member);

  v_bindings := public.seed_dornhain_catalog_bindings(v_project.id);
  v_chars := public.seed_dornhain_starter_characters(v_project.id, p_user_id);

  RETURN jsonb_build_object(
    'ok', true,
    'created', v_created,
    'projectId', v_project.id,
    'publicId', v_project.public_id,
    'worldProfileId', v_project.world_profile_id,
    'bindings', v_bindings,
    'characters', v_chars
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provision_dornhain_starter_for_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_dornhain_starter_for_user(UUID) TO service_role;

COMMENT ON FUNCTION public.provision_dornhain_starter_for_user(UUID) IS
  'Idempotent Dornhain default: project, world, catalog bindings, pregens, GM grants.';

-- ---------------------------------------------------------------------------
-- ensure_native_starter_project → shared provisioner (auth.uid path).
-- ---------------------------------------------------------------------------
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
  v_result JSONB;
  v_def public.saga_definitions%ROWTYPE;
  v_ver public.saga_definition_versions%ROWTYPE;
  existing public.projects%ROWTYPE;
  created public.projects%ROWTYPE;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF BTRIM(COALESCE(p_slug, '')) IN ('', 'dornhain.whisper') THEN
    v_result := public.provision_dornhain_starter_for_user(actor);
    IF COALESCE((v_result->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION '%', COALESCE(v_result->>'reason', 'provision_failed')
        USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object(
      'id', v_result->>'projectId',
      'public_id', v_result->>'publicId',
      'created', COALESCE((v_result->>'created')::boolean, false),
      'name', (SELECT name FROM public.projects WHERE id = (v_result->>'projectId')::uuid),
      'saga_id', (SELECT saga_id FROM public.projects WHERE id = (v_result->>'projectId')::uuid),
      'saga_version_id', (SELECT saga_version_id FROM public.projects WHERE id = (v_result->>'projectId')::uuid),
      'world_profile_id', v_result->>'worldProfileId',
      'bindings', (v_result->>'bindings')::int,
      'characters', (v_result->>'characters')::int
    );
  END IF;

  -- Non-Dornhain native slugs: create project only (legacy path).
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

REVOKE ALL ON FUNCTION public.ensure_native_starter_project(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_native_starter_project(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Signup hook: every new auth.users row gets Dornhain defaults.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_dornhain_starter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    PERFORM public.provision_dornhain_starter_for_user(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'dornhain starter provision failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_dornhain ON auth.users;
CREATE TRIGGER on_auth_user_created_dornhain
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_dornhain_starter();

-- ---------------------------------------------------------------------------
-- Backfill all existing accounts.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  u RECORD;
  v_result JSONB;
  v_ok INT := 0;
  v_fail INT := 0;
BEGIN
  FOR u IN SELECT id, email FROM auth.users ORDER BY created_at ASC
  LOOP
    BEGIN
      v_result := public.provision_dornhain_starter_for_user(u.id);
      IF COALESCE((v_result->>'ok')::boolean, false) THEN
        v_ok := v_ok + 1;
      ELSE
        v_fail := v_fail + 1;
        RAISE WARNING 'provision skip % (%): %', u.email, u.id, v_result;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      RAISE WARNING 'provision error % (%): %', u.email, u.id, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'dornhain backfill ok=% fail=%', v_ok, v_fail;
END;
$$;

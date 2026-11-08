-- 088: Seed Kosmischer Erdgeist as default GM presence character (nativeAssetId gm.earthspirit).
-- Portrait: public/assets/session/gm-earthspirit.jpg — UI via sagatree-native-gm-presence.
-- Not added to party catalog bindings.

CREATE OR REPLACE FUNCTION public.seed_dornhain_gm_presence_character(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  IF p_project_id IS NULL OR p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.characters c
    WHERE c.owner_user_id = p_user_id
      AND (
        c.attributes->>'nativeAssetId' = 'gm.earthspirit'
        OR (
          lower(c.name) IN ('kosmischer erdgeist', 'erdgeist')
          AND COALESCE(c.project_id, p_project_id) = p_project_id
        )
      )
  ) INTO v_exists;

  IF v_exists THEN
    UPDATE public.characters c
    SET
      project_id = COALESCE(c.project_id, p_project_id),
      name = 'Kosmischer Erdgeist',
      description = COALESCE(
        NULLIF(BTRIM(c.description), ''),
        'GM-Presence · Kosmischer Erdgeist'
      ),
      class = COALESCE(NULLIF(BTRIM(c.class), ''), 'Weltgeist'),
      portrait_url = COALESCE(
        NULLIF(BTRIM(c.portrait_url), ''),
        '/assets/session/gm-earthspirit.jpg?v=1'
      ),
      attributes = COALESCE(c.attributes, '{}'::jsonb) || jsonb_build_object(
        'nativeAssetId', 'gm.earthspirit',
        'gmPresence', true
      ),
      updated_at = NOW()
    WHERE c.owner_user_id = p_user_id
      AND (
        c.attributes->>'nativeAssetId' = 'gm.earthspirit'
        OR (
          lower(c.name) IN ('kosmischer erdgeist', 'erdgeist')
          AND COALESCE(c.project_id, p_project_id) = p_project_id
        )
      );
    RETURN 0;
  END IF;

  INSERT INTO public.characters (
    owner_user_id,
    project_id,
    name,
    description,
    class,
    race,
    level,
    ruleset_key,
    attributes,
    skills,
    inventory,
    character_type,
    sheet_status,
    portrait_url,
    sagatree_profile
  ) VALUES (
    p_user_id,
    p_project_id,
    'Kosmischer Erdgeist',
    'GM-Presence · Kosmischer Erdgeist',
    'Weltgeist',
    'human',
    1,
    'sagatree-core',
    jsonb_build_object(
      'strength', 2,
      'dexterity', 2,
      'endurance', 3,
      'mind', 4,
      'perception', 3,
      'charisma', 3,
      'nativeAssetId', 'gm.earthspirit',
      'gmPresence', true,
      'nativeStarterSheetVersion', 1
    ),
    '{}'::jsonb,
    '[]'::jsonb,
    'pc',
    'complete',
    '/assets/session/gm-earthspirit.jpg?v=1',
    jsonb_build_object(
      'nativeAssetId', 'gm.earthspirit',
      'gmPresence', true,
      'nativeStarterSheetVersion', 1
    )
  );

  RETURN 1;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_dornhain_gm_presence_character(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_dornhain_gm_presence_character(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.seed_dornhain_gm_presence_character(UUID, UUID) IS
  'Idempotent: create/update Kosmischer Erdgeist (gm.earthspirit) as GM default presence character.';

-- Extend Dornhain provisioner (077 body + GM presence seed).
CREATE OR REPLACE FUNCTION public.provision_dornhain_starter_for_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_gm INT := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
  END IF;

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
  v_gm := public.seed_dornhain_gm_presence_character(v_project.id, p_user_id);

  RETURN jsonb_build_object(
    'ok', true,
    'created', v_created,
    'projectId', v_project.id,
    'publicId', v_project.public_id,
    'worldProfileId', v_project.world_profile_id,
    'bindings', v_bindings,
    'characters', v_chars,
    'gmPresence', v_gm
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provision_dornhain_starter_for_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_dornhain_starter_for_user(UUID) TO service_role;

COMMENT ON FUNCTION public.provision_dornhain_starter_for_user(UUID) IS
  'Idempotent Dornhain default: project, world, catalog bindings, pregens, GM presence, GM grants.';

-- One-shot backfill for existing Dornhain GMs.
CREATE OR REPLACE FUNCTION public.seed_dornhain_gm_presence_for_all_owners()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
  v_total INT := 0;
  v_n INT;
BEGIN
  FOR r IN
    SELECT DISTINCT p.id AS project_id, p.gm_user_id AS user_id
    FROM public.projects p
    JOIN public.saga_definitions d ON d.id = p.saga_id
    WHERE p.gm_user_id IS NOT NULL
      AND d.slug = 'dornhain.whisper'
  LOOP
    v_n := public.seed_dornhain_gm_presence_character(r.project_id, r.user_id);
    v_total := v_total + COALESCE(v_n, 0);
  END LOOP;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_dornhain_gm_presence_for_all_owners() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_dornhain_gm_presence_for_all_owners() TO service_role;

SELECT public.seed_dornhain_gm_presence_for_all_owners();

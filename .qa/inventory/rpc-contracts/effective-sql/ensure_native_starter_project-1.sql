-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.ensure_native_starter_project(p_slug text = 'dornhain.whisper') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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

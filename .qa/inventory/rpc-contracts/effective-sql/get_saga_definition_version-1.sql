-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.get_saga_definition_version(p_version_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_ver public.saga_definition_versions%ROWTYPE;
  v_def public.saga_definitions%ROWTYPE;
  v_is_gm BOOLEAN := false;
  v_member BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ver FROM public.saga_definition_versions WHERE id = p_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saga-Fassung nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_def FROM public.saga_definitions WHERE id = v_ver.saga_id;

  -- Access: native published readable to any authenticated; else owner or project member on that saga.
  IF v_def.origin = 'native' AND v_ver.status = 'published' THEN
    v_member := true;
  ELSIF v_def.owner_user_id = v_user THEN
    v_member := true;
    v_is_gm := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.saga_id = v_def.id
        AND (
          p.gm_user_id = v_user
          OR public.current_user_is_active_project_member(p.id)
        )
    ) INTO v_member;
    SELECT EXISTS (
      SELECT 1 FROM public.projects p WHERE p.saga_id = v_def.id AND p.gm_user_id = v_user
    ) INTO v_is_gm;
  END IF;

  IF NOT v_member THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Native: treat requester as GM only if they GM a project on this saga (else player projection).
  IF v_def.origin = 'native' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.projects p WHERE p.saga_id = v_def.id AND p.gm_user_id = v_user
    ) INTO v_is_gm;
  END IF;

  RETURN jsonb_build_object(
    'sagaId', v_def.id,
    'sagaSlug', v_def.slug,
    'title', v_def.title,
    'synopsis', v_def.synopsis,
    'origin', v_def.origin,
    'versionId', v_ver.id,
    'versionLabel', v_ver.version_label,
    'status', v_ver.status,
    'payload', public.sagatree_project_saga_definition_payload(v_ver.payload, v_is_gm),
    'isGmProjection', v_is_gm
  );
END;
$$;

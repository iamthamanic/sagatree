-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.get_saga_definition_editor(p_saga_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_def public.saga_definitions%ROWTYPE;
  v_ver public.saga_definition_versions%ROWTYPE;
  v_can_edit BOOLEAN := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_def FROM public.saga_definitions WHERE id = p_saga_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saga-Definition nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  IF v_def.origin = 'native' THEN
    SELECT * INTO v_ver
    FROM public.saga_definition_versions
    WHERE saga_id = v_def.id AND status = 'published'
    ORDER BY published_at DESC NULLS LAST, created_at DESC
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Native Fassung fehlt' USING ERRCODE = 'P0002';
    END IF;
    v_can_edit := false;
  ELSIF v_def.owner_user_id = v_user THEN
    v_ver := public.sagatree_ensure_saga_draft(v_def.id);
    v_can_edit := true;
  ELSE
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
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
    'payload', v_ver.payload,
    'revision', v_def.draft_revision,
    'canEdit', v_can_edit,
    'isGmProjection', true
  );
END;
$$;

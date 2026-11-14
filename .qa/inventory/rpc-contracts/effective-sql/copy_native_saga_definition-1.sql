-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.copy_native_saga_definition(p_source_saga_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_src public.saga_definitions%ROWTYPE;
  v_pub public.saga_definition_versions%ROWTYPE;
  v_new_id UUID := gen_random_uuid();
  v_ver_id UUID := gen_random_uuid();
  v_draft_id UUID := gen_random_uuid();
  v_slug TEXT;
  v_payload JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_src FROM public.saga_definitions WHERE id = p_source_saga_id;
  IF NOT FOUND OR v_src.origin <> 'native' THEN
    RAISE EXCEPTION 'Nur native Sagas können kopiert werden' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pub
  FROM public.saga_definition_versions
  WHERE saga_id = v_src.id AND status = 'published'
  ORDER BY published_at DESC NULLS LAST, created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Native Fassung fehlt' USING ERRCODE = 'P0002';
  END IF;

  v_payload := v_pub.payload;
  v_slug := 'user.' || replace(v_new_id::text, '-', '');

  INSERT INTO public.saga_definitions (
    id, slug, title, synopsis, origin, owner_user_id, draft_revision
  ) VALUES (
    v_new_id,
    v_slug,
    v_src.title || ' (Kopie)',
    v_src.synopsis,
    'user',
    v_user,
    0
  );

  INSERT INTO public.saga_definition_versions (
    id, saga_id, version_label, status, payload, published_at
  ) VALUES (
    v_ver_id, v_new_id, 'v1', 'published', v_payload, NOW()
  );

  INSERT INTO public.saga_definition_versions (
    id, saga_id, version_label, status, payload, published_at
  ) VALUES (
    v_draft_id, v_new_id, 'draft', 'draft', v_payload, NULL
  );

  RETURN jsonb_build_object('sagaId', v_new_id, 'versionId', v_ver_id);
END;
$$;

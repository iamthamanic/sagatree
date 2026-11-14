-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.create_user_saga_definition(p_title text, p_blurb text = '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_new_id UUID := gen_random_uuid();
  v_draft_id UUID := gen_random_uuid();
  v_title TEXT;
  v_blurb TEXT;
  v_payload JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  v_title := NULLIF(BTRIM(COALESCE(p_title, '')), '');
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Titel darf nicht leer sein' USING ERRCODE = '22023';
  END IF;
  v_blurb := COALESCE(p_blurb, '');

  v_payload := jsonb_build_object(
    'packageId', NULL,
    'title', v_title,
    'blurb', v_blurb,
    'synopsis', v_blurb,
    'knowledgeFacts', '[]'::jsonb,
    'locations', '[]'::jsonb,
    'pregens', '[]'::jsonb
  );

  INSERT INTO public.saga_definitions (
    id, slug, title, synopsis, origin, owner_user_id, draft_revision
  ) VALUES (
    v_new_id,
    'user.' || replace(v_new_id::text, '-', ''),
    v_title,
    v_blurb,
    'user',
    v_user,
    0
  );

  INSERT INTO public.saga_definition_versions (
    id, saga_id, version_label, status, payload, published_at
  ) VALUES (
    v_draft_id, v_new_id, 'draft', 'draft', v_payload, NULL
  );

  RETURN jsonb_build_object('sagaId', v_new_id, 'versionId', v_draft_id, 'revision', 0);
END;
$$;

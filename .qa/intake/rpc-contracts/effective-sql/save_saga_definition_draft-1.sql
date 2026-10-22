-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.save_saga_definition_draft(p_saga_id uuid, p_payload jsonb, p_expected_revision integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_def public.saga_definitions%ROWTYPE;
  v_ver public.saga_definition_versions%ROWTYPE;
  v_title TEXT;
  v_blurb TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_def FROM public.saga_definitions WHERE id = p_saga_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saga-Definition nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  IF v_def.origin = 'native' THEN
    RAISE EXCEPTION 'Native Sagas sind unveränderlich' USING ERRCODE = '42501';
  END IF;
  IF v_def.owner_user_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_def.draft_revision IS DISTINCT FROM COALESCE(p_expected_revision, -1) THEN
    RAISE EXCEPTION 'Revisionskonflikt — bitte neu laden' USING ERRCODE = '40001';
  END IF;

  v_ver := public.sagatree_ensure_saga_draft(v_def.id);

  v_title := NULLIF(BTRIM(COALESCE(p_payload->>'title', '')), '');
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Titel darf nicht leer sein' USING ERRCODE = '22023';
  END IF;
  v_blurb := COALESCE(p_payload->>'blurb', p_payload->>'synopsis', '');

  UPDATE public.saga_definition_versions
     SET payload = COALESCE(p_payload, '{}'::jsonb)
   WHERE id = v_ver.id;

  UPDATE public.saga_definitions
     SET title = v_title,
         synopsis = v_blurb,
         draft_revision = draft_revision + 1,
         updated_at = NOW()
   WHERE id = v_def.id
  RETURNING * INTO v_def;

  SELECT * INTO v_ver FROM public.saga_definition_versions WHERE id = v_ver.id;

  RETURN jsonb_build_object(
    'sagaId', v_def.id,
    'versionId', v_ver.id,
    'revision', v_def.draft_revision,
    'payload', v_ver.payload
  );
END;
$$;

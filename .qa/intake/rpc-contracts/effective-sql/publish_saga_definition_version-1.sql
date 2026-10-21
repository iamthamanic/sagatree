-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.publish_saga_definition_version(p_saga_id uuid, p_expected_revision integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_def public.saga_definitions%ROWTYPE;
  v_draft public.saga_definition_versions%ROWTYPE;
  v_new public.saga_definition_versions%ROWTYPE;
  v_next_num INTEGER;
  v_label TEXT;
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

  v_draft := public.sagatree_ensure_saga_draft(v_def.id);
  IF NULLIF(BTRIM(COALESCE(v_draft.payload->>'title', v_def.title, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Titel darf nicht leer sein' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(MAX(
    CASE
      WHEN version_label ~ '^v[0-9]+$' THEN SUBSTRING(version_label FROM 2)::INTEGER
      ELSE 0
    END
  ), 0) + 1
  INTO v_next_num
  FROM public.saga_definition_versions
  WHERE saga_id = v_def.id AND status = 'published';

  v_label := 'v' || v_next_num::TEXT;

  INSERT INTO public.saga_definition_versions (
    saga_id, version_label, status, payload, published_at
  ) VALUES (
    v_def.id,
    v_label,
    'published',
    v_draft.payload,
    NOW()
  )
  RETURNING * INTO v_new;

  -- Draft stays editable; pinned projects keep their saga_version_id unchanged.

  RETURN jsonb_build_object(
    'sagaId', v_def.id,
    'versionId', v_new.id,
    'versionLabel', v_new.version_label,
    'revision', v_def.draft_revision
  );
END;
$$;

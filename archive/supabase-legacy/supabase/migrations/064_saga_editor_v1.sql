-- #575 — Saga Editor v1: draft revision, save/publish/copy/create RPCs.

ALTER TABLE public.saga_definitions
  ADD COLUMN IF NOT EXISTS draft_revision INTEGER NOT NULL DEFAULT 0;

-- Ensure a draft version row exists for owner edits (payload starts from latest published).
CREATE OR REPLACE FUNCTION public.sagadrive_ensure_saga_draft(p_saga_id UUID)
RETURNS public.saga_definition_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft public.saga_definition_versions%ROWTYPE;
  v_pub public.saga_definition_versions%ROWTYPE;
  v_payload JSONB := '{}'::jsonb;
BEGIN
  SELECT * INTO v_draft
  FROM public.saga_definition_versions
  WHERE saga_id = p_saga_id AND status = 'draft'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN v_draft;
  END IF;

  SELECT * INTO v_pub
  FROM public.saga_definition_versions
  WHERE saga_id = p_saga_id AND status = 'published'
  ORDER BY published_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_payload := v_pub.payload;
  END IF;

  INSERT INTO public.saga_definition_versions (
    saga_id, version_label, status, payload, published_at
  ) VALUES (
    p_saga_id,
    'draft',
    'draft',
    v_payload,
    NULL
  )
  RETURNING * INTO v_draft;

  RETURN v_draft;
END;
$$;

REVOKE ALL ON FUNCTION public.sagadrive_ensure_saga_draft(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_saga_definition_editor(p_saga_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    v_ver := public.sagadrive_ensure_saga_draft(v_def.id);
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

REVOKE ALL ON FUNCTION public.get_saga_definition_editor(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saga_definition_editor(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_saga_definition_draft(
  p_saga_id UUID,
  p_payload JSONB,
  p_expected_revision INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  v_ver := public.sagadrive_ensure_saga_draft(v_def.id);

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

REVOKE ALL ON FUNCTION public.save_saga_definition_draft(UUID, JSONB, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_saga_definition_draft(UUID, JSONB, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_saga_definition_version(
  p_saga_id UUID,
  p_expected_revision INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  v_draft := public.sagadrive_ensure_saga_draft(v_def.id);
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

REVOKE ALL ON FUNCTION public.publish_saga_definition_version(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_saga_definition_version(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.copy_native_saga_definition(p_source_saga_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

REVOKE ALL ON FUNCTION public.copy_native_saga_definition(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.copy_native_saga_definition(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_user_saga_definition(
  p_title TEXT,
  p_blurb TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

REVOKE ALL ON FUNCTION public.create_user_saga_definition(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_user_saga_definition(TEXT, TEXT) TO authenticated;

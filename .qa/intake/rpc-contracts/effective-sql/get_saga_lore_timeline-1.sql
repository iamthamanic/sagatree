-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.get_saga_lore_timeline(p_public_id text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_project RECORD;
  v_uid UUID := auth.uid();
  v_is_gm BOOLEAN;
  v_can_hidden BOOLEAN;
  v_entries JSONB := '[]'::jsonb;
  v_payload JSONB;
  v_elem JSONB;
  v_vis TEXT;
  v_recap RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT p.id, p.saga_id, p.saga_version_id
  INTO v_project
  FROM public.projects p
  WHERE p.public_id = UPPER(BTRIM(p_public_id));

  IF v_project.id IS NULL THEN
    RAISE EXCEPTION 'saga not found';
  END IF;

  IF NOT public.current_user_is_active_project_member(v_project.id)
     AND NOT public.is_project_gm(v_project.id, v_uid) THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  IF NOT public.has_saga_permission(v_project.id, 'saga.lore.read')
     AND NOT public.is_project_gm(v_project.id, v_uid) THEN
    RAISE EXCEPTION 'missing saga.lore.read';
  END IF;

  v_is_gm := public.is_project_gm(v_project.id, v_uid);
  v_can_hidden := v_is_gm
    OR public.has_saga_permission(v_project.id, 'saga.lore.read_hidden')
    OR public.has_saga_permission(v_project.id, 'saga.secrets.read');

  -- Episode recaps (sessions of this project).
  FOR v_recap IN
    SELECT s.public_id AS session_public_id, s.name AS session_name, s.session_number,
           r.summary_text, r.highlight_lines, r.updated_at
    FROM public.sessions s
    JOIN public.session_recaps r ON r.session_id = s.id
    WHERE s.project_id = v_project.id
    ORDER BY COALESCE(s.session_number, 0) DESC, r.updated_at DESC
    LIMIT 40
  LOOP
    v_entries := v_entries || jsonb_build_array(
      jsonb_build_object(
        'id', 'recap:' || COALESCE(v_recap.session_public_id, ''),
        'kind', 'recap',
        'title', COALESCE(v_recap.session_name, 'Episode'),
        'summary', COALESCE(v_recap.summary_text, ''),
        'visibility', 'shared',
        'occurredAt', v_recap.updated_at,
        'meta', jsonb_build_object(
          'sessionPublicId', v_recap.session_public_id,
          'sessionNumber', v_recap.session_number,
          'highlightLines', COALESCE(v_recap.highlight_lines, '[]'::jsonb)
        )
      )
    );
  END LOOP;

  -- Definition knowledge facts (if saga linked).
  IF v_project.saga_version_id IS NOT NULL THEN
    SELECT payload INTO v_payload
    FROM public.saga_definition_versions
    WHERE id = v_project.saga_version_id;

    FOR v_elem IN
      SELECT elem
      FROM jsonb_array_elements(COALESCE(v_payload->'knowledgeFacts', '[]'::jsonb)) AS elem
    LOOP
      v_vis := COALESCE(v_elem->>'visibility', 'gm_only');
      IF v_can_hidden OR v_vis IN ('public', 'shared', 'discovered') THEN
        v_entries := v_entries || jsonb_build_array(
          jsonb_build_object(
            'id', 'fact:' || COALESCE(v_elem->>'id', md5(v_elem::text)),
            'kind', 'knowledge',
            'title', COALESCE(v_elem->>'id', 'Wissen'),
            'summary', COALESCE(v_elem->>'summary', ''),
            'visibility', v_vis,
            'occurredAt', NULL,
            'meta', '{}'::jsonb
          )
        );
      END IF;
    END LOOP;
  END IF;

  -- Bound lore assets revealed to viewer.
  v_entries := v_entries || COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', 'binding:' || b.id::text,
        'kind', 'lore_binding',
        'title', NULLIF(BTRIM(b.label), ''),
        'summary', COALESCE(b.metadata->>'summary', ''),
        'visibility', b.reveal,
        'occurredAt', b.updated_at,
        'meta', jsonb_build_object('bindingId', b.id, 'reveal', b.reveal)
      )
    )
    FROM public.saga_asset_bindings b
    WHERE b.project_id = v_project.id
      AND b.asset_kind = 'lore'
      AND public.can_view_saga_binding(b.project_id, b.reveal, b.asset_kind)
      AND b.reveal <> 'unlisted'
  ), '[]'::jsonb);

  RETURN jsonb_build_object(
    'projectId', v_project.id,
    'canReadHidden', v_can_hidden,
    'entries', COALESCE(v_entries, '[]'::jsonb)
  );
END;
$$;

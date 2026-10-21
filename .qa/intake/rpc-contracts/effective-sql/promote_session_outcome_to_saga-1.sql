-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.promote_session_outcome_to_saga(p_session_id uuid, p_consequence_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session public.sessions%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_def public.saga_definitions%ROWTYPE;
  v_ver public.saga_definition_versions%ROWTYPE;
  v_cons JSONB;
  v_fact_id TEXT;
  v_visibility TEXT;
  v_summary TEXT;
  v_facts JSONB;
  v_exists BOOLEAN;
  v_promo public.session_outcome_promotions%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_project FROM public.projects WHERE id = v_session.project_id;
  IF NOT public.is_project_gm(v_project.id, v_user) THEN
    RAISE EXCEPTION 'Nur Gamemaster darf übernehmen' USING ERRCODE = '42501';
  END IF;

  IF v_project.saga_id IS NULL THEN
    RAISE EXCEPTION 'Keine Saga-Definition an diese Gruppe gebunden' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_def FROM public.saga_definitions WHERE id = v_project.saga_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saga-Definition nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  IF v_def.origin = 'native' THEN
    RAISE EXCEPTION 'Native Sagas sind unveränderlich — bitte zuerst als Kopie speichern' USING ERRCODE = '42501';
  END IF;
  IF v_def.owner_user_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'Nur die Autorin/der Autor der Saga darf in die Definition übernehmen' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_promo
  FROM public.session_outcome_promotions
  WHERE project_id = v_project.id
    AND source_kind = 'consequence'
    AND source_id = p_consequence_id
    AND target_kind = 'saga_fact';
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'targetKind', 'saga_fact',
      'targetRef', v_promo.target_ref
    );
  END IF;

  v_cons := public.sagatree_find_session_consequence(p_session_id, p_consequence_id);
  IF v_cons IS NULL THEN
    RAISE EXCEPTION 'Ereignis nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  v_summary := NULLIF(BTRIM(COALESCE(v_cons->>'summary', '')), '');
  IF v_summary IS NULL THEN
    RAISE EXCEPTION 'Ereignis ohne Text' USING ERRCODE = '22023';
  END IF;
  v_visibility := COALESCE(NULLIF(BTRIM(v_cons->>'visibility'), ''), 'shared');
  IF v_visibility NOT IN ('public', 'shared', 'gm_only', 'discovered', 'character_specific') THEN
    v_visibility := 'shared';
  END IF;
  v_fact_id := 'promoted:' || left(p_consequence_id, 64);

  v_ver := public.sagatree_ensure_saga_draft(v_def.id);
  v_facts := COALESCE(v_ver.payload->'knowledgeFacts', '[]'::jsonb);

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_facts) AS f
    WHERE f->>'id' = v_fact_id
  ) INTO v_exists;

  IF NOT v_exists THEN
    v_facts := v_facts || jsonb_build_array(
      jsonb_build_object(
        'id', v_fact_id,
        'visibility', v_visibility,
        'summary', left(v_summary, 200)
      )
    );
    UPDATE public.saga_definition_versions
       SET payload = jsonb_set(
         COALESCE(payload, '{}'::jsonb),
         '{knowledgeFacts}',
         v_facts,
         true
       )
     WHERE id = v_ver.id;
    UPDATE public.saga_definitions
       SET draft_revision = draft_revision + 1,
           updated_at = NOW()
     WHERE id = v_def.id;
  END IF;

  INSERT INTO public.session_outcome_promotions (
    project_id, session_id, source_kind, source_id, target_kind, target_ref, created_by
  ) VALUES (
    v_project.id, p_session_id, 'consequence', p_consequence_id, 'saga_fact', v_fact_id, v_user
  );

  PERFORM public.append_session_event(
    p_session_id,
    'adventure',
    v_user,
    jsonb_build_object(
      'op', 'promote_outcome',
      'target', 'saga',
      'consequenceId', p_consequence_id,
      'factId', v_fact_id
    ),
    COALESCE(v_session.runtime_revision, 0),
    'promote-saga:' || p_consequence_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'targetKind', 'saga_fact',
    'targetRef', v_fact_id,
    'messageDe', 'In die Saga-Definition übernommen (Entwurf).'
  );
END;
$$;

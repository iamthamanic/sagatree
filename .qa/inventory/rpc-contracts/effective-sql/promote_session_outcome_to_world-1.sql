-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.promote_session_outcome_to_world(p_session_id uuid, p_consequence_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session public.sessions%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_world UUID;
  v_cons JSONB;
  v_fact_id TEXT;
  v_summary TEXT;
  v_visibility TEXT;
  v_modules JSONB;
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

  v_world := v_project.world_profile_id;
  IF v_world IS NULL THEN
    RAISE EXCEPTION 'Keine Welt an diese Gruppe gebunden' USING ERRCODE = '22023';
  END IF;
  IF NOT public.current_user_can_edit_world_profile(v_world) THEN
    RAISE EXCEPTION 'Nur die Welt-Besitzerin/der Welt-Besitzer darf übernehmen' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_promo
  FROM public.session_outcome_promotions
  WHERE project_id = v_project.id
    AND source_kind = 'consequence'
    AND source_id = p_consequence_id
    AND target_kind = 'world_fact';
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'targetKind', 'world_fact',
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
  v_fact_id := 'promoted:' || left(p_consequence_id, 64);

  SELECT modules INTO v_modules FROM public.world_profiles WHERE id = v_world FOR UPDATE;
  v_modules := COALESCE(v_modules, '{}'::jsonb);
  v_facts := COALESCE(v_modules->'promotedLore'->'facts', '[]'::jsonb);

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_facts) AS f
    WHERE f->>'id' = v_fact_id
  ) INTO v_exists;

  IF NOT v_exists THEN
    v_facts := v_facts || jsonb_build_array(
      jsonb_build_object(
        'id', v_fact_id,
        'visibility', v_visibility,
        'summary', left(v_summary, 200),
        'sourceSessionId', p_session_id,
        'sourceConsequenceId', p_consequence_id
      )
    );
    v_modules := jsonb_set(
      v_modules,
      '{promotedLore}',
      COALESCE(v_modules->'promotedLore', '{}'::jsonb),
      true
    );
    v_modules := jsonb_set(v_modules, '{promotedLore,facts}', v_facts, true);
    UPDATE public.world_profiles
       SET modules = v_modules,
           updated_at = NOW()
     WHERE id = v_world;
  END IF;

  INSERT INTO public.session_outcome_promotions (
    project_id, session_id, source_kind, source_id, target_kind, target_ref, created_by
  ) VALUES (
    v_project.id, p_session_id, 'consequence', p_consequence_id, 'world_fact', v_fact_id, v_user
  );

  PERFORM public.append_session_event(
    p_session_id,
    'adventure',
    v_user,
    jsonb_build_object(
      'op', 'promote_outcome',
      'target', 'world',
      'consequenceId', p_consequence_id,
      'factId', v_fact_id
    ),
    COALESCE(v_session.runtime_revision, 0),
    'promote-world:' || p_consequence_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'targetKind', 'world_fact',
    'targetRef', v_fact_id,
    'messageDe', 'In die Welt übernommen.'
  );
END;
$$;

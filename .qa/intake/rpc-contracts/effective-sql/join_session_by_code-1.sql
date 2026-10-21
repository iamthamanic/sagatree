-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.join_session_by_code(p_code text, p_character_id uuid = NULL) RETURNS public.sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  actor UUID := auth.uid();
  v_session public.sessions;
  v_sheet_status TEXT;
  v_revision BIGINT;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NULLIF(BTRIM(p_code), '') IS NULL THEN RAISE EXCEPTION 'Session code is required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_session FROM public.sessions
   WHERE code IS NOT NULL AND UPPER(BTRIM(code)) = UPPER(BTRIM(p_code)) LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002'; END IF;
  IF v_session.status = 'completed' THEN RAISE EXCEPTION 'Session is completed' USING ERRCODE = '22023'; END IF;
  IF p_character_id IS NOT NULL THEN
    SELECT sheet_status INTO v_sheet_status FROM public.characters
     WHERE id = p_character_id AND owner_user_id = actor AND character_type = 'pc';
    IF NOT FOUND THEN RAISE EXCEPTION 'Character is not owned by the current user' USING ERRCODE = '42501'; END IF;
    IF COALESCE(v_sheet_status, 'complete') <> 'complete' THEN
      RAISE EXCEPTION 'Unvollständige Charakterbögen können keiner Session beitreten' USING ERRCODE = '22023';
    END IF;
  END IF;
  PERFORM public.ensure_active_project_player(v_session.project_id, actor, p_character_id);
  INSERT INTO public.session_players (session_id, user_id, character_id, is_online)
  VALUES (v_session.id, actor, p_character_id, true)
  ON CONFLICT (session_id, user_id) DO UPDATE
    SET character_id = COALESCE(EXCLUDED.character_id, public.session_players.character_id),
        is_online = true, left_at = NULL;

  v_revision := COALESCE(v_session.runtime_revision, 0) + 1;
  UPDATE public.sessions
     SET runtime_revision = v_revision, updated_at = NOW()
   WHERE id = v_session.id
  RETURNING * INTO v_session;

  PERFORM public.append_session_event(
    v_session.id,
    'join',
    actor,
    jsonb_build_object('characterId', p_character_id),
    v_revision,
    NULL
  );

  RETURN v_session;
END;
$$;

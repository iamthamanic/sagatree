-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.set_session_player_presence(p_session_id uuid, p_is_online boolean, p_expected_revision bigint = NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  actor UUID := auth.uid();
  v_session public.sessions;
  v_revision BIGINT;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_session_participant(p_session_id, actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_expected_revision IS NOT NULL
     AND v_session.runtime_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'stale revision: expected %, actual %',
      p_expected_revision, v_session.runtime_revision
      USING ERRCODE = '40001';
  END IF;

  UPDATE public.session_players
     SET is_online = COALESCE(p_is_online, false)
   WHERE session_id = p_session_id AND user_id = actor;

  v_revision := v_session.runtime_revision + 1;
  UPDATE public.sessions
     SET runtime_revision = v_revision, updated_at = NOW()
   WHERE id = p_session_id;

  PERFORM public.append_session_event(
    p_session_id,
    'presence',
    actor,
    jsonb_build_object('isOnline', COALESCE(p_is_online, false)),
    v_revision,
    NULL
  );

  RETURN public.get_session_runtime_snapshot(p_session_id);
END;
$$;

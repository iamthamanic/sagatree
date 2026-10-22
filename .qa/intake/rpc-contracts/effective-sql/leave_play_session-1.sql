-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.leave_play_session(p_session_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  actor UUID := auth.uid();
  v_session public.sessions;
  v_revision BIGINT;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF FOUND THEN
    DELETE FROM public.session_players WHERE session_id = p_session_id AND user_id = actor;
    v_revision := COALESCE(v_session.runtime_revision, 0) + 1;
    UPDATE public.sessions
       SET runtime_revision = v_revision, updated_at = NOW()
     WHERE id = p_session_id;
    PERFORM public.append_session_event(
      p_session_id,
      'leave',
      actor,
      '{}'::jsonb,
      v_revision,
      NULL
    );
  ELSE
    DELETE FROM public.session_players WHERE session_id = p_session_id AND user_id = actor;
  END IF;
END;
$$;

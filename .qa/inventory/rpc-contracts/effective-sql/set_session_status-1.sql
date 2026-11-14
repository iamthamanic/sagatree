-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.set_session_status(p_session_id uuid, p_status text) RETURNS public.sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  actor UUID := auth.uid();
  v_session public.sessions;
  v_from TEXT;
  v_revision BIGINT;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('waiting', 'active', 'paused', 'completed') THEN
    RAISE EXCEPTION 'Invalid session status' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.is_project_gm(v_session.project_id, actor) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  v_from := v_session.status;
  IF v_from = 'scheduled' THEN v_from := 'waiting'; END IF;
  IF v_from = 'completed' THEN RAISE EXCEPTION 'Completed sessions cannot change status' USING ERRCODE = '22023'; END IF;
  IF NOT (
    (v_from = 'waiting' AND p_status IN ('active', 'completed'))
    OR (v_from = 'active' AND p_status IN ('paused', 'completed'))
    OR (v_from = 'paused' AND p_status IN ('active', 'completed'))
  ) THEN
    RAISE EXCEPTION 'Illegal status transition from % to %', v_from, p_status USING ERRCODE = '22023';
  END IF;

  v_revision := COALESCE(v_session.runtime_revision, 0) + 1;

  UPDATE public.sessions SET
    status = p_status,
    runtime_revision = v_revision,
    updated_at = NOW(),
    started_at = CASE WHEN p_status = 'active' AND started_at IS NULL THEN NOW() ELSE started_at END,
    ended_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE ended_at END
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  PERFORM public.append_session_event(
    p_session_id,
    'status',
    actor,
    jsonb_build_object('from', v_from, 'to', p_status),
    v_revision,
    NULL
  );

  IF p_status = 'completed' THEN
    PERFORM public.sagatree_upsert_session_recap(p_session_id);
  END IF;

  RETURN v_session;
END;
$$;

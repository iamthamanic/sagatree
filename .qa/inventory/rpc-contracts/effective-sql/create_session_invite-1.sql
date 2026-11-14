-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.create_session_invite(p_session_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  actor UUID := auth.uid();
  v_session public.sessions;
  v_token TEXT;
  v_expires TIMESTAMPTZ;
  v_id UUID;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_session.status = 'completed' THEN
    RAISE EXCEPTION 'Session is completed' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_project_gm(v_session.project_id, actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Rotate: revoke prior active invites for this session.
  UPDATE public.session_invites
     SET revoked_at = NOW()
   WHERE session_id = p_session_id
     AND revoked_at IS NULL;

  v_token := public.generate_session_invite_token();
  v_expires := NOW() + INTERVAL '7 days';

  INSERT INTO public.session_invites (session_id, token, created_by, expires_at)
  VALUES (p_session_id, v_token, actor, v_expires)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'session_id', v_session.id,
    'expires_at', v_expires
  );
END;
$$;

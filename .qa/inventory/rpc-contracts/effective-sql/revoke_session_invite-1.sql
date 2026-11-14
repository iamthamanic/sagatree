-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.revoke_session_invite(p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  actor UUID := auth.uid();
  v_invite public.session_invites;
  v_session public.sessions;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(BTRIM(p_token), '') IS NULL THEN
    RAISE EXCEPTION 'token required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_invite
    FROM public.session_invites
   WHERE token = BTRIM(p_token)
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = v_invite.session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.is_project_gm(v_session.project_id, actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_invite.revoked_at IS NULL THEN
    UPDATE public.session_invites SET revoked_at = NOW() WHERE id = v_invite.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_invite.id);
END;
$$;

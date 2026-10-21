-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.resolve_session_invite(p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  actor UUID := auth.uid();
  v_invite public.session_invites;
  v_session public.sessions;
  v_saga_public_id TEXT;
  v_already_member BOOLEAN := false;
  v_is_gm BOOLEAN := false;
  v_character_id UUID;
  v_character_public_id TEXT;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(BTRIM(p_token), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'missing_token');
  END IF;

  SELECT * INTO v_invite
    FROM public.session_invites
   WHERE token = BTRIM(p_token)
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'not_found');
  END IF;
  IF v_invite.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'revoked');
  END IF;
  IF v_invite.expires_at <= NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'expired');
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = v_invite.session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'session_missing');
  END IF;
  IF v_session.status = 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'session_completed');
  END IF;

  SELECT p.public_id INTO v_saga_public_id
    FROM public.projects p
   WHERE p.id = v_session.project_id;
  IF v_saga_public_id IS NULL OR BTRIM(v_saga_public_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'saga_missing');
  END IF;

  v_is_gm := public.is_project_gm(v_session.project_id, actor);

  SELECT true, sp.character_id
    INTO v_already_member, v_character_id
    FROM public.session_players sp
   WHERE sp.session_id = v_session.id
     AND sp.user_id = actor
     AND sp.left_at IS NULL
   LIMIT 1;
  IF NOT FOUND THEN
    v_already_member := false;
    v_character_id := NULL;
  END IF;

  IF v_character_id IS NOT NULL THEN
    SELECT c.public_id INTO v_character_public_id
      FROM public.characters c
     WHERE c.id = v_character_id;
  END IF;

  UPDATE public.session_invites
     SET last_resolved_at = NOW()
   WHERE id = v_invite.id;

  -- Facts only — never invent a role claim for the client to assert privilege.
  RETURN jsonb_build_object(
    'ok', true,
    'saga_public_id', upper(btrim(v_saga_public_id)),
    'session_public_id', upper(btrim(v_session.public_id)),
    'project_id', v_session.project_id,
    'session_id', v_session.id,
    'session_status', v_session.status,
    'already_member', COALESCE(v_already_member, false),
    'is_project_gm', v_is_gm,
    'character_public_id', NULLIF(upper(btrim(COALESCE(v_character_public_id, ''))), '')
  );
END;
$$;

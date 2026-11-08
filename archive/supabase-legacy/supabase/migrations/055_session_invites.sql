-- 055: Session invite share tokens (#490)
-- Opaque invite credential → resolve → existing session-join entry.
-- Role is never granted by URL; membership/RLS remain authority.

CREATE TABLE IF NOT EXISTS public.session_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  last_resolved_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS session_invites_token_uidx
  ON public.session_invites (token);

CREATE INDEX IF NOT EXISTS session_invites_session_id_idx
  ON public.session_invites (session_id)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE public.session_invites IS
  'Opaque share credentials for session invite links (#490). Not authorization; resolve + membership/RLS authorize.';

ALTER TABLE public.session_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.generate_session_invite_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  candidate TEXT;
  attempt INT := 0;
BEGIN
  LOOP
    attempt := attempt + 1;
    IF attempt > 16 THEN
      RAISE EXCEPTION 'session invite token collision retries exhausted' USING ERRCODE = 'P0001';
    END IF;
    candidate := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.session_invites i WHERE i.token = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_session_invite_token() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_session_invite(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

REVOKE ALL ON FUNCTION public.create_session_invite(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_session_invite(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_session_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

REVOKE ALL ON FUNCTION public.revoke_session_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_session_invite(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_session_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

REVOKE ALL ON FUNCTION public.resolve_session_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_session_invite(TEXT) TO authenticated;

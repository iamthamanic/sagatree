-- 040: Player-test session join codes + authoritative lifecycle RPCs (#296 / Epic #210)
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS code TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'sessions' AND constraint_name = 'sessions_status_check'
  ) THEN
    ALTER TABLE public.sessions DROP CONSTRAINT sessions_status_check;
  END IF;
END $$;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('scheduled', 'waiting', 'active', 'paused', 'completed'));

CREATE UNIQUE INDEX IF NOT EXISTS sessions_code_uidx
  ON public.sessions (UPPER(BTRIM(code)))
  WHERE code IS NOT NULL AND BTRIM(code) <> '';

COMMENT ON COLUMN public.sessions.code IS
  'Server-generated join code for play sessions. Not a substitute for auth; membership/RLS authorize.';

CREATE OR REPLACE FUNCTION public.generate_unique_session_code()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate TEXT; attempt INT := 0; i INT;
BEGIN
  LOOP
    attempt := attempt + 1;
    IF attempt > 32 THEN
      RAISE EXCEPTION 'session code collision retries exhausted' USING ERRCODE = 'P0001';
    END IF;
    candidate := '';
    FOR i IN 1..6 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::INT, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.sessions s WHERE s.code IS NOT NULL AND UPPER(BTRIM(s.code)) = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$$;
REVOKE ALL ON FUNCTION public.generate_unique_session_code() FROM PUBLIC;

UPDATE public.sessions SET code = public.generate_unique_session_code()
 WHERE (code IS NULL OR BTRIM(code) = '') AND status IS DISTINCT FROM 'completed';

CREATE OR REPLACE FUNCTION public.is_project_gm(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = p_project_id AND p.gm_user_id = p_user_id)
      OR EXISTS (SELECT 1 FROM public.project_members pm
                 WHERE pm.project_id = p_project_id AND pm.user_id = p_user_id
                   AND pm.status = 'active' AND pm.role = 'gm');
$$;
REVOKE ALL ON FUNCTION public.is_project_gm(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_project_gm(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_active_project_player(
  p_project_id UUID, p_user_id UUID, p_character_id UUID DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM public.project_members
   WHERE project_id = p_project_id AND user_id = p_user_id;
  IF FOUND THEN
    IF v_status IS DISTINCT FROM 'active' THEN
      UPDATE public.project_members SET status = 'active',
             character_id = COALESCE(p_character_id, character_id)
       WHERE project_id = p_project_id AND user_id = p_user_id;
    ELSIF p_character_id IS NOT NULL THEN
      UPDATE public.project_members SET character_id = p_character_id
       WHERE project_id = p_project_id AND user_id = p_user_id;
    END IF;
    RETURN;
  END IF;
  INSERT INTO public.project_members (project_id, user_id, character_id, role, status)
  VALUES (p_project_id, p_user_id, p_character_id, 'player', 'active');
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_active_project_player(UUID, UUID, UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_play_session(p_project_id UUID, p_name TEXT DEFAULT NULL)
RETURNS public.sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor UUID := auth.uid(); created public.sessions;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_project_id IS NULL THEN RAISE EXCEPTION 'project_id required' USING ERRCODE = '22023'; END IF;
  IF NOT public.is_project_gm(p_project_id, actor) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.sessions (project_id, session_number, name, status, code)
  VALUES (p_project_id, public.allocate_next_session_number(p_project_id), NULLIF(BTRIM(p_name), ''), 'waiting', public.generate_unique_session_code())
  RETURNING * INTO created;
  RETURN created;
END;
$$;
REVOKE ALL ON FUNCTION public.create_play_session(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_play_session(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_project_session(
  p_project_id UUID, p_name TEXT DEFAULT NULL, p_notes TEXT DEFAULT NULL
) RETURNS public.sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE created public.sessions; actor UUID := auth.uid(); is_member BOOLEAN := false;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
     WHERE pm.project_id = p_project_id AND pm.user_id = actor AND pm.status = 'active' AND pm.role IN ('gm', 'player')
  ) OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = p_project_id AND p.gm_user_id = actor)
  INTO is_member;
  IF NOT is_member THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.sessions (project_id, session_number, name, notes, status, code)
  VALUES (p_project_id, public.allocate_next_session_number(p_project_id), NULLIF(btrim(p_name), ''), NULLIF(btrim(p_notes), ''), 'scheduled', public.generate_unique_session_code())
  RETURNING * INTO created;
  RETURN created;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_session_by_code(p_code TEXT, p_character_id UUID DEFAULT NULL)
RETURNS public.sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor UUID := auth.uid(); v_session public.sessions; v_sheet_status TEXT;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NULLIF(BTRIM(p_code), '') IS NULL THEN RAISE EXCEPTION 'Session code is required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_session FROM public.sessions
   WHERE code IS NOT NULL AND UPPER(BTRIM(code)) = UPPER(BTRIM(p_code)) LIMIT 1;
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
  RETURN v_session;
END;
$$;
REVOKE ALL ON FUNCTION public.join_session_by_code(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_session_by_code(TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_session_status(p_session_id UUID, p_status TEXT)
RETURNS public.sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor UUID := auth.uid(); v_session public.sessions; v_from TEXT;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('waiting', 'active', 'paused', 'completed') THEN
    RAISE EXCEPTION 'Invalid session status' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
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
  UPDATE public.sessions SET status = p_status, updated_at = NOW(),
         started_at = CASE WHEN p_status = 'active' AND started_at IS NULL THEN NOW() ELSE started_at END,
         ended_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE ended_at END
   WHERE id = p_session_id RETURNING * INTO v_session;
  RETURN v_session;
END;
$$;
REVOKE ALL ON FUNCTION public.set_session_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_session_status(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_play_session(p_session_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor UUID := auth.uid();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.session_players WHERE session_id = p_session_id AND user_id = actor;
END;
$$;
REVOKE ALL ON FUNCTION public.leave_play_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_play_session(UUID) TO authenticated;

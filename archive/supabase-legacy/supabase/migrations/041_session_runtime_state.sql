-- 041: Authoritative session runtime revision + append-only session_events (#297 / Epic #210)
-- Separates live runtime concurrency from definition/membership columns.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS runtime_revision BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.sessions.runtime_revision IS
  'Monotonic concurrency token for authoritative SessionRuntimeState writes. Clients must send expected_revision.';

CREATE TABLE IF NOT EXISTS public.session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'join', 'leave', 'presence', 'status', 'roll', 'damage',
    'condition', 'scene', 'combat', 'gameplay'
  )),
  actor_user_id UUID REFERENCES auth.users(id),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  revision_after BIGINT NOT NULL,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS session_events_session_created_idx
  ON public.session_events (session_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS session_events_session_idempotency_uidx
  ON public.session_events (session_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND BTRIM(idempotency_key) <> '';

COMMENT ON TABLE public.session_events IS
  'Append-only audit/log for play-session actions. Not a full event-sourced store.';

ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view session events" ON public.session_events;
CREATE POLICY "Members can view session events" ON public.session_events
  FOR SELECT USING (
    session_id IN (
      SELECT s.id FROM public.sessions s
      WHERE public.is_project_gm(s.project_id, auth.uid())
         OR EXISTS (
           SELECT 1 FROM public.session_players sp
           WHERE sp.session_id = s.id AND sp.user_id = auth.uid()
         )
         OR EXISTS (
           SELECT 1 FROM public.project_members pm
           WHERE pm.project_id = s.project_id
             AND pm.user_id = auth.uid()
             AND pm.status = 'active'
         )
    )
  );

-- No client INSERT/UPDATE/DELETE — mutations go through SECURITY DEFINER RPCs only.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'session_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.session_events;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_session_participant(p_session_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = p_session_id
      AND (
        public.is_project_gm(s.project_id, p_user_id)
        OR EXISTS (
          SELECT 1 FROM public.session_players sp
          WHERE sp.session_id = s.id AND sp.user_id = p_user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = s.project_id
            AND pm.user_id = p_user_id
            AND pm.status = 'active'
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.is_session_participant(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_session_participant(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.append_session_event(
  p_session_id UUID,
  p_kind TEXT,
  p_actor UUID,
  p_payload JSONB,
  p_revision_after BIGINT,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.session_events (
    session_id, kind, actor_user_id, payload, revision_after, idempotency_key
  ) VALUES (
    p_session_id,
    p_kind,
    p_actor,
    COALESCE(p_payload, '{}'::jsonb),
    p_revision_after,
    NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '')
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.append_session_event(UUID, TEXT, UUID, JSONB, BIGINT, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_session_runtime_snapshot(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor UUID := auth.uid();
  v_session public.sessions;
  v_roster JSONB;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id required' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_session_participant(p_session_id, actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'userId', sp.user_id,
      'characterId', sp.character_id,
      'isOnline', sp.is_online,
      'joinedAt', sp.joined_at
    )
    ORDER BY sp.joined_at
  ), '[]'::jsonb)
  INTO v_roster
  FROM public.session_players sp
  WHERE sp.session_id = p_session_id;

  RETURN jsonb_build_object(
    'sessionId', v_session.id,
    'revision', v_session.runtime_revision,
    'status', CASE WHEN v_session.status = 'scheduled' THEN 'waiting' ELSE v_session.status END,
    'roster', v_roster,
    'gameplay', jsonb_build_object(
      'sceneId', COALESCE(v_session.world_state->>'sceneId', v_session.world_state->>'scene_id'),
      'combatActive', COALESCE(
        (v_session.world_state->>'combatActive')::boolean,
        (v_session.world_state->>'combat_active')::boolean,
        false
      ),
      'shared', COALESCE(v_session.world_state->'shared', '{}'::jsonb)
    ),
    'updatedAt', v_session.updated_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_session_runtime_snapshot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_session_runtime_snapshot(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_session_runtime_command(
  p_session_id UUID,
  p_expected_revision BIGINT,
  p_kind TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor UUID := auth.uid();
  v_session public.sessions;
  v_new_revision BIGINT;
  v_world JSONB;
  v_existing public.session_events;
  v_key TEXT := NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '');
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id required' USING ERRCODE = '22023';
  END IF;
  IF p_kind NOT IN (
    'join', 'leave', 'presence', 'status', 'roll', 'damage',
    'condition', 'scene', 'combat', 'gameplay'
  ) THEN
    RAISE EXCEPTION 'Invalid event kind' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_session_participant(p_session_id, actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.session_events
    WHERE session_id = p_session_id AND idempotency_key = v_key
    LIMIT 1;
    IF FOUND THEN
      RETURN public.get_session_runtime_snapshot(p_session_id)
        || jsonb_build_object('idempotentReplay', true, 'eventId', v_existing.id);
    END IF;
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_session.status = 'completed' AND p_kind NOT IN ('leave', 'presence') THEN
    RAISE EXCEPTION 'Completed sessions cannot accept gameplay commands' USING ERRCODE = '22023';
  END IF;
  IF v_session.runtime_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'stale revision: expected %, actual %',
      p_expected_revision, v_session.runtime_revision
      USING ERRCODE = '40001';
  END IF;

  v_new_revision := v_session.runtime_revision + 1;
  v_world := COALESCE(v_session.world_state, '{}'::jsonb);

  IF p_kind IN ('scene', 'combat', 'gameplay', 'condition', 'damage', 'roll') THEN
    IF NOT public.is_project_gm(v_session.project_id, actor) AND p_kind IN ('scene', 'combat', 'gameplay') THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF p_payload ? 'sceneId' THEN
      v_world := jsonb_set(v_world, '{sceneId}', to_jsonb(p_payload->>'sceneId'), true);
    END IF;
    IF p_payload ? 'combatActive' THEN
      v_world := jsonb_set(v_world, '{combatActive}', to_jsonb((p_payload->>'combatActive')::boolean), true);
    END IF;
    IF p_payload ? 'shared' AND jsonb_typeof(p_payload->'shared') = 'object' THEN
      v_world := jsonb_set(v_world, '{shared}', p_payload->'shared', true);
    END IF;
  END IF;

  IF p_kind = 'presence' THEN
    UPDATE public.session_players
       SET is_online = COALESCE((p_payload->>'isOnline')::boolean, true)
     WHERE session_id = p_session_id AND user_id = actor;
  END IF;

  IF p_kind = 'status' THEN
    IF NOT public.is_project_gm(v_session.project_id, actor) THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    -- Status transitions stay on set_session_status; this path only bumps revision + audit.
  END IF;

  UPDATE public.sessions
     SET runtime_revision = v_new_revision,
         world_state = v_world,
         updated_at = NOW()
   WHERE id = p_session_id;

  PERFORM public.append_session_event(
    p_session_id, p_kind, actor, COALESCE(p_payload, '{}'::jsonb), v_new_revision, v_key
  );

  RETURN public.get_session_runtime_snapshot(p_session_id)
    || jsonb_build_object('idempotentReplay', false);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_session_runtime_command(UUID, BIGINT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_session_runtime_command(UUID, BIGINT, TEXT, JSONB, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_session_player_presence(
  p_session_id UUID,
  p_is_online BOOLEAN,
  p_expected_revision BIGINT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
REVOKE ALL ON FUNCTION public.set_session_player_presence(UUID, BOOLEAN, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_session_player_presence(UUID, BOOLEAN, BIGINT) TO authenticated;

-- Bump revision + audit when lifecycle status changes (#296 RPC extended).
CREATE OR REPLACE FUNCTION public.set_session_status(p_session_id UUID, p_status TEXT)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

  RETURN v_session;
END;
$$;

-- Join audits an event when a player row is upserted.
CREATE OR REPLACE FUNCTION public.join_session_by_code(p_code TEXT, p_character_id UUID DEFAULT NULL)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

CREATE OR REPLACE FUNCTION public.leave_play_session(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

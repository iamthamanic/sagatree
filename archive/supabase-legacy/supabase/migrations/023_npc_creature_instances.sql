-- NPC/creature adventure/session instances (#201).
-- Instances hold frozen definition snapshots + mutable runtime (HP/conditions/temp controller).
-- Writes go through SECURITY DEFINER RPCs only — no direct INSERT/UPDATE/DELETE for authenticated.

-- ---------------------------------------------------------------------------
-- 1. Instances table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.npc_creature_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  definition_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  instance_kind TEXT NOT NULL CHECK (instance_kind IN ('generic', 'persistent')),
  sequence_number INTEGER NOT NULL CHECK (sequence_number >= 1 AND sequence_number <= 100000),
  snapshot JSONB NOT NULL,
  runtime JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(snapshot) = 'object'),
  CHECK (jsonb_typeof(runtime) = 'object'),
  CONSTRAINT npc_creature_instances_definition_id_len
    CHECK (char_length(btrim(definition_id)) BETWEEN 10 AND 160),
  CONSTRAINT npc_creature_instances_display_name_len
    CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 120),
  CONSTRAINT npc_creature_instances_persistent_no_session
    CHECK (
      (instance_kind = 'persistent' AND session_id IS NULL)
      OR (instance_kind = 'generic')
    )
);

CREATE INDEX IF NOT EXISTS idx_npc_creature_instances_project
  ON public.npc_creature_instances(project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_npc_creature_instances_session
  ON public.npc_creature_instances(session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_npc_creature_instances_definition
  ON public.npc_creature_instances(project_id, definition_id);

COMMENT ON TABLE public.npc_creature_instances IS
  'Adventure/session NPC/creature instances with frozen definition snapshot and mutable runtime. Orthogonal to campaign controller assignments (#200).';

COMMENT ON COLUMN public.npc_creature_instances.snapshot IS
  'Frozen NpcCreatureDefinitionSnapshot at spawn; definition updates must not rewrite this.';

COMMENT ON COLUMN public.npc_creature_instances.runtime IS
  'Mutable runtime: currentHp, conditions, temporaryControllerUserId, encounterNotes.';

ALTER TABLE public.npc_creature_instances ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.npc_creature_instances FROM PUBLIC;
REVOKE ALL ON TABLE public.npc_creature_instances FROM anon;
-- Authenticated may SELECT only; writes via RPCs.
GRANT SELECT ON TABLE public.npc_creature_instances TO authenticated;
GRANT ALL ON TABLE public.npc_creature_instances TO service_role;

CREATE POLICY "Read npc creature instances for active project members"
  ON public.npc_creature_instances
  FOR SELECT
  USING (
    public.current_user_is_active_project_member(project_id)
  );

-- Deliberately no INSERT / UPDATE / DELETE policies for authenticated.

CREATE OR REPLACE FUNCTION public.set_npc_creature_instances_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_npc_creature_instances_updated_at
  ON public.npc_creature_instances;
CREATE TRIGGER trg_npc_creature_instances_updated_at
  BEFORE UPDATE ON public.npc_creature_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.set_npc_creature_instances_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Helper: actor must be project GM + active member
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_npc_creature_instance_gm(p_project_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'missing project';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND p.gm_user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'only gm may manage instances';
  END IF;

  IF NOT public.current_user_is_active_project_member(p_project_id) THEN
    RAISE EXCEPTION 'actor is not an active project member';
  END IF;

  RETURN v_actor;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_npc_creature_instance_gm(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_npc_creature_instance_gm(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.assert_npc_creature_instance_gm(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Spawn RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.spawn_npc_creature_instance(
  p_project_id UUID,
  p_definition_id TEXT,
  p_instance_kind TEXT,
  p_snapshot JSONB,
  p_runtime JSONB,
  p_display_name TEXT,
  p_sequence_number INTEGER,
  p_session_id UUID DEFAULT NULL
)
RETURNS public.npc_creature_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID;
  v_definition_id TEXT := btrim(COALESCE(p_definition_id, ''));
  v_display_name TEXT := btrim(COALESCE(p_display_name, ''));
  v_kind TEXT := btrim(COALESCE(p_instance_kind, ''));
  v_row public.npc_creature_instances;
  v_session_project UUID;
BEGIN
  v_actor := public.assert_npc_creature_instance_gm(p_project_id);

  IF char_length(v_definition_id) < 10 OR char_length(v_definition_id) > 160 THEN
    RAISE EXCEPTION 'invalid definition id';
  END IF;

  IF v_kind NOT IN ('generic', 'persistent') THEN
    RAISE EXCEPTION 'invalid instance kind';
  END IF;

  IF char_length(v_display_name) < 1 OR char_length(v_display_name) > 120 THEN
    RAISE EXCEPTION 'invalid display name';
  END IF;

  IF p_sequence_number IS NULL OR p_sequence_number < 1 THEN
    RAISE EXCEPTION 'invalid sequence number';
  END IF;

  IF jsonb_typeof(p_snapshot) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid snapshot';
  END IF;

  IF jsonb_typeof(p_runtime) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid runtime';
  END IF;

  -- Persistent uniques are campaign-scoped (no session).
  IF v_kind = 'persistent' AND p_session_id IS NOT NULL THEN
    RAISE EXCEPTION 'persistent instances must not bind a session';
  END IF;

  IF p_session_id IS NOT NULL THEN
    SELECT s.project_id INTO v_session_project
    FROM public.sessions s
    WHERE s.id = p_session_id;
    IF v_session_project IS NULL OR v_session_project IS DISTINCT FROM p_project_id THEN
      RAISE EXCEPTION 'session does not belong to project';
    END IF;
  END IF;

  -- Definition reference validation:
  -- - core:/builtin: ids are snapshot-only (no DB row required)
  -- - personal:/world: must exist and be readable by actor (or archived but still present)
  IF v_definition_id LIKE 'personal:%' OR v_definition_id LIKE 'world:%' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.npc_creature_definitions d
      WHERE d.id = v_definition_id
        AND (
          (d.scope = 'personal' AND d.owner_user_id = v_actor)
          OR (d.scope = 'world' AND public.current_user_can_read_world_profile(d.world_profile_id))
        )
    ) THEN
      RAISE EXCEPTION 'definition not readable';
    END IF;
  END IF;

  -- Temp controller inside runtime must be null or active member.
  IF p_runtime ? 'temporaryControllerUserId'
     AND jsonb_typeof(p_runtime->'temporaryControllerUserId') = 'string'
     AND btrim(p_runtime->>'temporaryControllerUserId') <> '' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = p_project_id
        AND pm.user_id = (p_runtime->>'temporaryControllerUserId')::uuid
        AND pm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'temporary controller is not an active project member';
    END IF;
  END IF;

  INSERT INTO public.npc_creature_instances (
    project_id,
    session_id,
    definition_id,
    display_name,
    instance_kind,
    sequence_number,
    snapshot,
    runtime,
    created_by,
    created_at,
    updated_at
  )
  VALUES (
    p_project_id,
    CASE WHEN v_kind = 'persistent' THEN NULL ELSE p_session_id END,
    v_definition_id,
    v_display_name,
    v_kind,
    p_sequence_number,
    p_snapshot,
    p_runtime,
    v_actor,
    NOW(),
    NOW()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.spawn_npc_creature_instance(UUID, TEXT, TEXT, JSONB, JSONB, TEXT, INTEGER, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.spawn_npc_creature_instance(UUID, TEXT, TEXT, JSONB, JSONB, TEXT, INTEGER, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.spawn_npc_creature_instance(UUID, TEXT, TEXT, JSONB, JSONB, TEXT, INTEGER, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Update runtime RPC (never rewrites snapshot)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_npc_creature_instance_runtime(
  p_instance_id UUID,
  p_runtime JSONB
)
RETURNS public.npc_creature_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.npc_creature_instances;
  v_actor UUID;
BEGIN
  IF p_instance_id IS NULL THEN
    RAISE EXCEPTION 'missing instance';
  END IF;

  IF jsonb_typeof(p_runtime) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid runtime';
  END IF;

  SELECT * INTO v_row
  FROM public.npc_creature_instances
  WHERE id = p_instance_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'instance not found';
  END IF;

  v_actor := public.assert_npc_creature_instance_gm(v_row.project_id);

  IF p_runtime ? 'temporaryControllerUserId'
     AND jsonb_typeof(p_runtime->'temporaryControllerUserId') = 'string'
     AND btrim(p_runtime->>'temporaryControllerUserId') <> '' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = v_row.project_id
        AND pm.user_id = (p_runtime->>'temporaryControllerUserId')::uuid
        AND pm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'temporary controller is not an active project member';
    END IF;
  END IF;

  -- Snapshot column intentionally untouched.
  UPDATE public.npc_creature_instances
  SET runtime = p_runtime,
      updated_at = NOW()
  WHERE id = p_instance_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.update_npc_creature_instance_runtime(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_npc_creature_instance_runtime(UUID, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_npc_creature_instance_runtime(UUID, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Remove instance RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.remove_npc_creature_instance(
  p_instance_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.npc_creature_instances;
BEGIN
  IF p_instance_id IS NULL THEN
    RAISE EXCEPTION 'missing instance';
  END IF;

  SELECT * INTO v_row
  FROM public.npc_creature_instances
  WHERE id = p_instance_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'instance not found';
  END IF;

  PERFORM public.assert_npc_creature_instance_gm(v_row.project_id);

  DELETE FROM public.npc_creature_instances WHERE id = p_instance_id;
  RETURN p_instance_id;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_npc_creature_instance(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_npc_creature_instance(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.remove_npc_creature_instance(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Clear temporary controllers for a session (session end)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.clear_npc_creature_instance_temp_controllers_for_session(
  p_session_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_id UUID;
  v_count INTEGER := 0;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'missing session';
  END IF;

  SELECT s.project_id INTO v_project_id
  FROM public.sessions s
  WHERE s.id = p_session_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'session not found';
  END IF;

  PERFORM public.assert_npc_creature_instance_gm(v_project_id);

  UPDATE public.npc_creature_instances
  SET runtime = jsonb_set(
        COALESCE(runtime, '{}'::jsonb),
        '{temporaryControllerUserId}',
        'null'::jsonb,
        true
      ),
      updated_at = NOW()
  WHERE session_id = p_session_id
    AND runtime ? 'temporaryControllerUserId'
    AND runtime->>'temporaryControllerUserId' IS NOT NULL
    AND btrim(COALESCE(runtime->>'temporaryControllerUserId', '')) <> '';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_npc_creature_instance_temp_controllers_for_session(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_npc_creature_instance_temp_controllers_for_session(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.clear_npc_creature_instance_temp_controllers_for_session(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Clear temp controller when member leaves (instance-level only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.clear_npc_creature_instance_temp_controller_on_member_inactive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID;
  v_project UUID;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'active'
     AND NEW.status IS DISTINCT FROM 'active' THEN
    v_user := NEW.user_id;
    v_project := NEW.project_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
    v_user := OLD.user_id;
    v_project := OLD.project_id;
  ELSE
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  UPDATE public.npc_creature_instances
  SET runtime = jsonb_set(
        COALESCE(runtime, '{}'::jsonb),
        '{temporaryControllerUserId}',
        'null'::jsonb,
        true
      ),
      updated_at = NOW()
  WHERE project_id = v_project
    AND runtime->>'temporaryControllerUserId' = v_user::text;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_npc_creature_instance_temp_controller_on_member_inactive
  ON public.project_members;
CREATE TRIGGER trg_clear_npc_creature_instance_temp_controller_on_member_inactive
  AFTER UPDATE OF status OR DELETE ON public.project_members
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_npc_creature_instance_temp_controller_on_member_inactive();

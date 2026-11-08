-- NPC/creature controller assignments (#200).
-- Controller is orthogonal to sheet mode and definition identity.
-- Writes go through SECURITY DEFINER RPC only — no direct INSERT for authenticated.

-- ---------------------------------------------------------------------------
-- 1. Assignment table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.npc_creature_controller_assignments (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  definition_id TEXT NOT NULL,
  controller_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, definition_id),
  CONSTRAINT npc_creature_controller_assignments_definition_id_len
    CHECK (char_length(btrim(definition_id)) BETWEEN 10 AND 160)
);

CREATE INDEX IF NOT EXISTS idx_npc_creature_controller_by_user
  ON public.npc_creature_controller_assignments(controller_user_id)
  WHERE controller_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_npc_creature_controller_by_project
  ON public.npc_creature_controller_assignments(project_id);

COMMENT ON TABLE public.npc_creature_controller_assignments IS
  'Campaign controller for a Full NPC/creature definition. Unassigned (NULL) = GM control. Does not change sheet mode or identity.';

ALTER TABLE public.npc_creature_controller_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.npc_creature_controller_assignments FROM PUBLIC;
REVOKE ALL ON TABLE public.npc_creature_controller_assignments FROM anon;
-- Authenticated may SELECT only; writes via assign_npc_creature_controller.
GRANT SELECT ON TABLE public.npc_creature_controller_assignments TO authenticated;
GRANT ALL ON TABLE public.npc_creature_controller_assignments TO service_role;

CREATE POLICY "Read controller assignments for active project members"
  ON public.npc_creature_controller_assignments
  FOR SELECT
  USING (
    public.current_user_is_active_project_member(project_id)
  );

-- Deliberately no INSERT / UPDATE / DELETE policies for authenticated.

CREATE OR REPLACE FUNCTION public.set_npc_creature_controller_assignments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_npc_creature_controller_assignments_updated_at
  ON public.npc_creature_controller_assignments;
CREATE TRIGGER trg_npc_creature_controller_assignments_updated_at
  BEFORE UPDATE ON public.npc_creature_controller_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_npc_creature_controller_assignments_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Assign RPC (GM + active membership, fail-closed)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assign_npc_creature_controller(
  p_project_id UUID,
  p_definition_id TEXT,
  p_controller_user_id UUID DEFAULT NULL
)
RETURNS public.npc_creature_controller_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_definition_id TEXT := btrim(COALESCE(p_definition_id, ''));
  v_row public.npc_creature_controller_assignments;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'missing project';
  END IF;

  IF char_length(v_definition_id) < 10 OR char_length(v_definition_id) > 160 THEN
    RAISE EXCEPTION 'invalid definition id';
  END IF;

  -- Actor must be the project GM and an active member.
  IF NOT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND p.gm_user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'only gm may assign controller';
  END IF;

  IF NOT public.current_user_is_active_project_member(p_project_id) THEN
    RAISE EXCEPTION 'actor is not an active project member';
  END IF;

  -- Controller must be null (unassigned / GM) or an active member.
  IF p_controller_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = p_project_id
        AND pm.user_id = p_controller_user_id
        AND pm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'controller is not an active project member';
    END IF;
  END IF;

  -- Prefer Full sheet when a persisted definition exists; fail closed if present but not full.
  IF EXISTS (
    SELECT 1
    FROM public.npc_creature_definitions d
    WHERE d.id = v_definition_id
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.npc_creature_definitions d
    WHERE d.id = v_definition_id
      AND d.status = 'active'
      AND COALESCE(d.payload->>'sheetMode', '') = 'full'
  ) THEN
    RAISE EXCEPTION 'definition is not a full character sheet';
  END IF;

  INSERT INTO public.npc_creature_controller_assignments (
    project_id,
    definition_id,
    controller_user_id,
    assigned_by,
    updated_at
  )
  VALUES (
    p_project_id,
    v_definition_id,
    p_controller_user_id,
    v_actor,
    NOW()
  )
  ON CONFLICT (project_id, definition_id) DO UPDATE
  SET
    controller_user_id = EXCLUDED.controller_user_id,
    assigned_by = EXCLUDED.assigned_by,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_npc_creature_controller(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_npc_creature_controller(UUID, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_npc_creature_controller(UUID, TEXT, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Clear controller when member leaves / is deactivated
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.clear_npc_creature_controller_on_member_inactive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'active'
     AND NEW.status IS DISTINCT FROM 'active' THEN
    UPDATE public.npc_creature_controller_assignments
    SET controller_user_id = NULL,
        updated_at = NOW()
    WHERE project_id = NEW.project_id
      AND controller_user_id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
    UPDATE public.npc_creature_controller_assignments
    SET controller_user_id = NULL,
        updated_at = NOW()
    WHERE project_id = OLD.project_id
      AND controller_user_id = OLD.user_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_npc_creature_controller_on_member_inactive
  ON public.project_members;
CREATE TRIGGER trg_clear_npc_creature_controller_on_member_inactive
  AFTER UPDATE OF status OR DELETE ON public.project_members
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_npc_creature_controller_on_member_inactive();

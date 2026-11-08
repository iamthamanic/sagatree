-- NPC/creature definitions (#196): personal + world catalog persistence.
-- Session instances are NOT stored here. Legacy D&D npcs/bestiary remain untouched
-- and are not the SagaDrive source of truth.

-- ---------------------------------------------------------------------------
-- 1. Catalog table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.npc_creature_definitions (
  id TEXT PRIMARY KEY CHECK (char_length(btrim(id)) BETWEEN 10 AND 160),
  scope TEXT NOT NULL CHECK (scope IN ('world', 'personal')),
  -- RESTRICT: deleting a world_profiles row must not hard-delete World definitions.
  world_profile_id UUID REFERENCES public.world_profiles(id) ON DELETE RESTRICT,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  payload_version INTEGER NOT NULL DEFAULT 1 CHECK (payload_version >= 1 AND payload_version <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT npc_creature_definitions_id_prefix
    CHECK (id LIKE scope || ':%'),
  CONSTRAINT npc_creature_definitions_scope_binding
    CHECK (
      (scope = 'world' AND world_profile_id IS NOT NULL)
      OR (scope = 'personal' AND world_profile_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_npc_creature_definitions_world
  ON public.npc_creature_definitions(world_profile_id, status)
  WHERE world_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_npc_creature_definitions_owner
  ON public.npc_creature_definitions(owner_user_id, status)
  WHERE scope = 'personal';

CREATE INDEX IF NOT EXISTS idx_npc_creature_definitions_updated
  ON public.npc_creature_definitions(updated_at DESC);

COMMENT ON TABLE public.npc_creature_definitions IS
  'SagaDrive NPC/creature library definitions (personal + world). Not session instances; not legacy D&D npcs/bestiary.';

COMMENT ON COLUMN public.npc_creature_definitions.payload IS
  'NpcCreatureDefinition contract without id/scope (columns). Machtgrad is derived, not authored.';

COMMENT ON COLUMN public.npc_creature_definitions.status IS
  'archived definitions leave authoring lists but stay resolvable for future instances.';

COMMENT ON COLUMN public.npc_creature_definitions.payload_version IS
  'Contract version for payload shape; mirrors domains/npc-creature payload version.';

ALTER TABLE public.npc_creature_definitions ENABLE ROW LEVEL SECURITY;

-- Anon must not read or write definitions.
REVOKE ALL ON TABLE public.npc_creature_definitions FROM PUBLIC;
REVOKE ALL ON TABLE public.npc_creature_definitions FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.npc_creature_definitions TO authenticated;
GRANT ALL ON TABLE public.npc_creature_definitions TO service_role;

-- Visibility: own Personal definitions, plus World definitions of a world the
-- user may read. Archived rows stay selectable so future instances can resolve.
CREATE POLICY "Read own personal and readable world npc creature definitions"
  ON public.npc_creature_definitions
  FOR SELECT
  USING (
    (scope = 'personal' AND owner_user_id = auth.uid())
    OR (scope = 'world' AND public.current_user_can_read_world_profile(world_profile_id))
  );

CREATE POLICY "Insert own personal and editable world npc creature definitions"
  ON public.npc_creature_definitions
  FOR INSERT
  WITH CHECK (
    owner_user_id = auth.uid()
    AND (
      scope = 'personal'
      OR (scope = 'world' AND public.current_user_can_edit_world_profile(world_profile_id))
    )
  );

CREATE POLICY "Update own personal and editable world npc creature definitions"
  ON public.npc_creature_definitions
  FOR UPDATE
  USING (
    (scope = 'personal' AND owner_user_id = auth.uid())
    OR (scope = 'world' AND public.current_user_can_edit_world_profile(world_profile_id))
  )
  WITH CHECK (
    (scope = 'personal' AND owner_user_id = auth.uid())
    OR (scope = 'world' AND public.current_user_can_edit_world_profile(world_profile_id))
  );

-- Deliberately no DELETE policy: definitions are archived, never hard-deleted,
-- so later session instances can always resolve their definition id.

CREATE OR REPLACE FUNCTION public.set_npc_creature_definitions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Identity columns are immutable: renaming must never change which id an
-- instance points at, or move a row to another scope/world/owner.
CREATE OR REPLACE FUNCTION public.prevent_npc_creature_definition_retarget()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'npc_creature_definitions.id is immutable';
  END IF;
  IF NEW.scope IS DISTINCT FROM OLD.scope THEN
    RAISE EXCEPTION 'npc_creature_definitions.scope is immutable';
  END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'npc_creature_definitions.owner_user_id is immutable';
  END IF;
  IF NEW.world_profile_id IS DISTINCT FROM OLD.world_profile_id THEN
    RAISE EXCEPTION 'npc_creature_definitions.world_profile_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_npc_creature_definitions_updated_at ON public.npc_creature_definitions;
CREATE TRIGGER trg_npc_creature_definitions_updated_at
  BEFORE UPDATE ON public.npc_creature_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_npc_creature_definitions_updated_at();

DROP TRIGGER IF EXISTS trg_npc_creature_definitions_no_retarget ON public.npc_creature_definitions;
CREATE TRIGGER trg_npc_creature_definitions_no_retarget
  BEFORE UPDATE ON public.npc_creature_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_npc_creature_definition_retarget();

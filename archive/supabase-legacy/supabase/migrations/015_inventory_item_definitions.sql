-- Inventory v2 (#107): catalog persistence for World/Personal item definitions
-- plus the minimal links needed to resolve a character's effective world profile.
--
-- Core definitions are NOT stored here. They are a versioned static source in the
-- repository and read-only at runtime, which the scope CHECK below enforces.

-- ---------------------------------------------------------------------------
-- 1. Effective world profile links
--
-- Neither characters nor projects (Adventures) referenced world_profiles yet.
-- These two nullable columns are the smallest addition that makes the binding
-- rule resolvable; Adventure/World ownership is otherwise untouched.
-- ---------------------------------------------------------------------------

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS world_profile_id UUID REFERENCES public.world_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS world_profile_id UUID REFERENCES public.world_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.characters.world_profile_id IS
  'Character''s own world-profile binding. Fallback when the adventure does not bind one.';

COMMENT ON COLUMN public.projects.world_profile_id IS
  'Adventure-level world-profile binding. Takes precedence over the character binding.';

CREATE INDEX IF NOT EXISTS idx_characters_world_profile
  ON public.characters(world_profile_id)
  WHERE world_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_world_profile
  ON public.projects(world_profile_id)
  WHERE world_profile_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. World-profile authorization helpers
--
-- Read and write authority are deliberately different. Editing follows the
-- existing world-profile model (owner only). Reading additionally covers players
-- of an adventure bound to that world, because otherwise a player could never
-- see the World items their own adventure runs on.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_can_edit_world_profile(p_world_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.world_profiles wp
    WHERE wp.id = p_world_profile_id
      AND wp.owner_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_read_world_profile(p_world_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.world_profiles wp
    WHERE wp.id = p_world_profile_id
      AND wp.owner_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.world_profile_id = p_world_profile_id
      AND (
        p.gm_user_id = auth.uid()
        OR public.current_user_is_active_project_member(p.id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_can_edit_world_profile(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_can_read_world_profile(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_edit_world_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_read_world_profile(UUID) TO authenticated;

-- Binding a project or character to a world profile is an authorization grant
-- (the read helper below admits adventure GM + members). Without this check a
-- GM could point projects.world_profile_id at any world and read another user's
-- World definitions — the same "client-writable row becomes a grant" pattern
-- migration 004 eliminated for project_members.
CREATE OR REPLACE FUNCTION public.enforce_world_profile_binding_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.world_profile_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.world_profile_id IS NOT DISTINCT FROM OLD.world_profile_id THEN
    RETURN NEW;
  END IF;
  IF NOT public.current_user_can_edit_world_profile(NEW.world_profile_id) THEN
    RAISE EXCEPTION 'world_profile_id may only reference a world profile you can edit';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_world_profile_binding ON public.projects;
CREATE TRIGGER trg_projects_world_profile_binding
  BEFORE INSERT OR UPDATE OF world_profile_id ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_world_profile_binding_ownership();

DROP TRIGGER IF EXISTS trg_characters_world_profile_binding ON public.characters;
CREATE TRIGGER trg_characters_world_profile_binding
  BEFORE INSERT OR UPDATE OF world_profile_id ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_world_profile_binding_ownership();

-- ---------------------------------------------------------------------------
-- 3. Catalog table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_item_definitions (
  id TEXT PRIMARY KEY CHECK (char_length(btrim(id)) BETWEEN 3 AND 128),
  scope TEXT NOT NULL CHECK (scope IN ('world', 'personal')),
  -- RESTRICT, not CASCADE: deleting a world_profiles row must not hard-delete
  -- World definitions. Archiving is the only removal path so owned instances
  -- always keep resolving; a cascade would bypass the missing DELETE policy
  -- (FK cascades run as the table owner).
  world_profile_id UUID REFERENCES public.world_profiles(id) ON DELETE RESTRICT,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(payload) = 'object'),
  -- The id carries its scope, so a row can never be re-read as a different
  -- scope, and 'core:' ids are unreachable because scope excludes 'core'.
  CONSTRAINT inventory_item_definitions_id_prefix
    CHECK (id LIKE scope || ':%'),
  CONSTRAINT inventory_item_definitions_scope_binding
    CHECK (
      (scope = 'world' AND world_profile_id IS NOT NULL)
      OR (scope = 'personal' AND world_profile_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_inventory_item_definitions_world
  ON public.inventory_item_definitions(world_profile_id, status)
  WHERE world_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_item_definitions_owner
  ON public.inventory_item_definitions(owner_user_id, status)
  WHERE scope = 'personal';

COMMENT ON TABLE public.inventory_item_definitions IS
  'Inventory v2 World and Personal item definitions. Core definitions live in the repository, not here.';

COMMENT ON COLUMN public.inventory_item_definitions.payload IS
  'ItemDefinition contract from src/domains/character/inventory-v2 (without id/scope, which are columns).';

COMMENT ON COLUMN public.inventory_item_definitions.status IS
  'archived definitions leave the Add catalog but stay resolvable for owned instances.';

ALTER TABLE public.inventory_item_definitions ENABLE ROW LEVEL SECURITY;

-- Visibility: own Personal definitions, plus World definitions of a world the
-- user may read. Archived rows stay selectable so owned instances still resolve.
CREATE POLICY "Read own personal and readable world item definitions"
  ON public.inventory_item_definitions
  FOR SELECT
  USING (
    (scope = 'personal' AND owner_user_id = auth.uid())
    OR (scope = 'world' AND public.current_user_can_read_world_profile(world_profile_id))
  );

CREATE POLICY "Insert own personal and editable world item definitions"
  ON public.inventory_item_definitions
  FOR INSERT
  WITH CHECK (
    owner_user_id = auth.uid()
    AND (
      scope = 'personal'
      OR (scope = 'world' AND public.current_user_can_edit_world_profile(world_profile_id))
    )
  );

CREATE POLICY "Update own personal and editable world item definitions"
  ON public.inventory_item_definitions
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
-- so an owned ItemInstance can always resolve its definition id.

CREATE OR REPLACE FUNCTION public.set_inventory_item_definitions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Identity columns are immutable: renaming or editing a definition must never
-- change which id an owned instance points at, or move it to another scope/world.
CREATE OR REPLACE FUNCTION public.prevent_inventory_item_definition_retarget()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'inventory_item_definitions.id is immutable';
  END IF;
  IF NEW.scope IS DISTINCT FROM OLD.scope THEN
    RAISE EXCEPTION 'inventory_item_definitions.scope is immutable';
  END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'inventory_item_definitions.owner_user_id is immutable';
  END IF;
  IF NEW.world_profile_id IS DISTINCT FROM OLD.world_profile_id THEN
    RAISE EXCEPTION 'inventory_item_definitions.world_profile_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_item_definitions_updated_at ON public.inventory_item_definitions;
CREATE TRIGGER trg_inventory_item_definitions_updated_at
  BEFORE UPDATE ON public.inventory_item_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_inventory_item_definitions_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_item_definitions_no_retarget ON public.inventory_item_definitions;
CREATE TRIGGER trg_inventory_item_definitions_no_retarget
  BEFORE UPDATE ON public.inventory_item_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_inventory_item_definition_retarget();

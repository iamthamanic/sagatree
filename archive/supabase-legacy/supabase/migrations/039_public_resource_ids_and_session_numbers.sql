-- 039: SagaDrive Public IDs + concurrency-safe session numbers (#276)
-- Adds immutable public_id columns (SA/SE/CH/IT/NPCC), backfill, UNIQUE constraints,
-- and allocate_next_session_number / create_project_session RPCs.
-- Does NOT rename projects→sagas; does NOT change internal PKs or projects.code.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Public ID generator (alphabet excludes O/0/I/1; body = 5 chars; ≥1 letter+digit)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_sagadrive_public_id(p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  body TEXT;
  i INT;
  idx INT;
  has_letter BOOLEAN;
  has_digit BOOLEAN;
  ch TEXT;
  attempt INT := 0;
BEGIN
  IF p_prefix IS NULL OR length(p_prefix) < 2 THEN
    RAISE EXCEPTION 'invalid public id prefix';
  END IF;

  LOOP
    attempt := attempt + 1;
    IF attempt > 64 THEN
      RAISE EXCEPTION 'failed to generate public id body';
    END IF;

    body := '';
    FOR i IN 1..5 LOOP
      idx := 1 + (get_byte(gen_random_bytes(1), 0) % length(alphabet));
      body := body || substr(alphabet, idx, 1);
    END LOOP;

    has_letter := body ~ '[A-Z]';
    has_digit := body ~ '[2-9]';
    IF has_letter AND has_digit THEN
      RETURN upper(p_prefix) || '-' || body;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_public_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  prefix TEXT;
BEGIN
  IF NEW.public_id IS NOT NULL AND btrim(NEW.public_id) <> '' THEN
    NEW.public_id := upper(btrim(NEW.public_id));
    RETURN NEW;
  END IF;

  prefix := TG_ARGV[0];
  NEW.public_id := public.generate_sagadrive_public_id(prefix);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.forbid_public_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.public_id IS DISTINCT FROM OLD.public_id THEN
    RAISE EXCEPTION 'public_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Columns (nullable → backfill → NOT NULL UNIQUE)
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS public_id TEXT;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS public_id TEXT;

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS public_id TEXT;

ALTER TABLE public.inventory_item_definitions
  ADD COLUMN IF NOT EXISTS public_id TEXT;

ALTER TABLE public.npc_creature_definitions
  ADD COLUMN IF NOT EXISTS public_id TEXT;

-- Backfill
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.projects WHERE public_id IS NULL LOOP
    UPDATE public.projects
      SET public_id = public.generate_sagadrive_public_id('SA')
      WHERE id = r.id;
  END LOOP;

  FOR r IN SELECT id FROM public.sessions WHERE public_id IS NULL LOOP
    UPDATE public.sessions
      SET public_id = public.generate_sagadrive_public_id('SE')
      WHERE id = r.id;
  END LOOP;

  FOR r IN SELECT id FROM public.characters WHERE public_id IS NULL LOOP
    UPDATE public.characters
      SET public_id = public.generate_sagadrive_public_id('CH')
      WHERE id = r.id;
  END LOOP;

  FOR r IN SELECT id FROM public.inventory_item_definitions WHERE public_id IS NULL LOOP
    UPDATE public.inventory_item_definitions
      SET public_id = public.generate_sagadrive_public_id('IT')
      WHERE id = r.id;
  END LOOP;

  FOR r IN SELECT id FROM public.npc_creature_definitions WHERE public_id IS NULL LOOP
    UPDATE public.npc_creature_definitions
      SET public_id = public.generate_sagadrive_public_id('NPCC')
      WHERE id = r.id;
  END LOOP;
END;
$$;

ALTER TABLE public.projects
  ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE public.sessions
  ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE public.characters
  ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE public.inventory_item_definitions
  ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE public.npc_creature_definitions
  ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS projects_public_id_uidx
  ON public.projects (public_id);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_public_id_uidx
  ON public.sessions (public_id);
CREATE UNIQUE INDEX IF NOT EXISTS characters_public_id_uidx
  ON public.characters (public_id);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_item_definitions_public_id_uidx
  ON public.inventory_item_definitions (public_id);
CREATE UNIQUE INDEX IF NOT EXISTS npc_creature_definitions_public_id_uidx
  ON public.npc_creature_definitions (public_id);

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_public_id_format;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_public_id_format
  CHECK (public_id ~ '^SA-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$');

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_public_id_format;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_public_id_format
  CHECK (public_id ~ '^SE-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$');

ALTER TABLE public.characters
  DROP CONSTRAINT IF EXISTS characters_public_id_format;
ALTER TABLE public.characters
  ADD CONSTRAINT characters_public_id_format
  CHECK (public_id ~ '^CH-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$');

ALTER TABLE public.inventory_item_definitions
  DROP CONSTRAINT IF EXISTS inventory_item_definitions_public_id_format;
ALTER TABLE public.inventory_item_definitions
  ADD CONSTRAINT inventory_item_definitions_public_id_format
  CHECK (public_id ~ '^IT-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$');

ALTER TABLE public.npc_creature_definitions
  DROP CONSTRAINT IF EXISTS npc_creature_definitions_public_id_format;
ALTER TABLE public.npc_creature_definitions
  ADD CONSTRAINT npc_creature_definitions_public_id_format
  CHECK (public_id ~ '^NPCC-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$');

-- Session order uniqueness (saga-scoped)
CREATE UNIQUE INDEX IF NOT EXISTS sessions_project_session_number_uidx
  ON public.sessions (project_id, session_number);

-- Triggers: assign + freeze public_id
DROP TRIGGER IF EXISTS trg_projects_ensure_public_id ON public.projects;
CREATE TRIGGER trg_projects_ensure_public_id
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_public_id('SA');

DROP TRIGGER IF EXISTS trg_projects_forbid_public_id_change ON public.projects;
CREATE TRIGGER trg_projects_forbid_public_id_change
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.forbid_public_id_change();

DROP TRIGGER IF EXISTS trg_sessions_ensure_public_id ON public.sessions;
CREATE TRIGGER trg_sessions_ensure_public_id
  BEFORE INSERT ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_public_id('SE');

DROP TRIGGER IF EXISTS trg_sessions_forbid_public_id_change ON public.sessions;
CREATE TRIGGER trg_sessions_forbid_public_id_change
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.forbid_public_id_change();

DROP TRIGGER IF EXISTS trg_characters_ensure_public_id ON public.characters;
CREATE TRIGGER trg_characters_ensure_public_id
  BEFORE INSERT ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_public_id('CH');

DROP TRIGGER IF EXISTS trg_characters_forbid_public_id_change ON public.characters;
CREATE TRIGGER trg_characters_forbid_public_id_change
  BEFORE UPDATE ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.forbid_public_id_change();

DROP TRIGGER IF EXISTS trg_inventory_item_definitions_ensure_public_id ON public.inventory_item_definitions;
CREATE TRIGGER trg_inventory_item_definitions_ensure_public_id
  BEFORE INSERT ON public.inventory_item_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_public_id('IT');

DROP TRIGGER IF EXISTS trg_inventory_item_definitions_forbid_public_id_change ON public.inventory_item_definitions;
CREATE TRIGGER trg_inventory_item_definitions_forbid_public_id_change
  BEFORE UPDATE ON public.inventory_item_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.forbid_public_id_change();

DROP TRIGGER IF EXISTS trg_npc_creature_definitions_ensure_public_id ON public.npc_creature_definitions;
CREATE TRIGGER trg_npc_creature_definitions_ensure_public_id
  BEFORE INSERT ON public.npc_creature_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_public_id('NPCC');

DROP TRIGGER IF EXISTS trg_npc_creature_definitions_forbid_public_id_change ON public.npc_creature_definitions;
CREATE TRIGGER trg_npc_creature_definitions_forbid_public_id_change
  BEFORE UPDATE ON public.npc_creature_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.forbid_public_id_change();

COMMENT ON COLUMN public.projects.public_id IS
  'Immutable public saga id (SA-XXXXX). Not a secret; auth/RLS authorize access.';
COMMENT ON COLUMN public.sessions.public_id IS
  'Immutable public session id (SE-XXXXX). session_number remains saga order.';
COMMENT ON COLUMN public.characters.public_id IS
  'Immutable public character id (CH-XXXXX).';
COMMENT ON COLUMN public.inventory_item_definitions.public_id IS
  'Immutable public item id (IT-XXXXX); internal TEXT PK unchanged.';
COMMENT ON COLUMN public.npc_creature_definitions.public_id IS
  'Immutable public NPC/creature id (NPCC-XXXXX); internal TEXT PK unchanged.';

-- ---------------------------------------------------------------------------
-- Concurrency-safe session number allocation + create RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.allocate_next_session_number(p_project_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INT;
BEGIN
  IF p_project_id IS NULL THEN
    RAISE EXCEPTION 'project_id required';
  END IF;

  -- Serialize creators per saga without blocking readers.
  PERFORM pg_advisory_xact_lock(hashtext(p_project_id::text));

  SELECT COALESCE(MAX(session_number), 0) + 1
    INTO next_number
    FROM public.sessions
   WHERE project_id = p_project_id;

  RETURN next_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_project_session(
  p_project_id UUID,
  p_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created public.sessions;
  actor UUID := auth.uid();
  is_member BOOLEAN := false;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.project_members pm
     WHERE pm.project_id = p_project_id
       AND pm.user_id = actor
       AND pm.status = 'active'
       AND pm.role IN ('gm', 'player')
  ) OR EXISTS (
    SELECT 1 FROM public.projects p
     WHERE p.id = p_project_id AND p.gm_user_id = actor
  )
  INTO is_member;

  IF NOT is_member THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.sessions (
    project_id,
    session_number,
    name,
    notes,
    status
  ) VALUES (
    p_project_id,
    public.allocate_next_session_number(p_project_id),
    NULLIF(btrim(p_name), ''),
    NULLIF(btrim(p_notes), ''),
    'scheduled'
  )
  RETURNING * INTO created;

  RETURN created;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_next_session_number(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_project_session(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_next_session_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_project_session(UUID, TEXT, TEXT) TO authenticated;

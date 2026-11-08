-- Character adventure arcs: participation + development history per project/adventure.

CREATE TABLE IF NOT EXISTS public.character_adventure_arcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'left')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  summary TEXT,
  developments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (character_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_character_adventure_arcs_character
  ON public.character_adventure_arcs(character_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_character_adventure_arcs_project
  ON public.character_adventure_arcs(project_id);

COMMENT ON TABLE public.character_adventure_arcs IS
  'Per-character adventure/campaign participation with a JSONB development timeline.';

COMMENT ON COLUMN public.character_adventure_arcs.developments IS
  'Ordered list of {id,at,kind,title,detail?,meta?} development entries.';

ALTER TABLE public.character_adventure_arcs ENABLE ROW LEVEL SECURITY;

-- Owner can read arcs for their characters (incl. historical completed/left).
CREATE POLICY "Owners select character adventure arcs"
  ON public.character_adventure_arcs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.characters c
      WHERE c.id = character_adventure_arcs.character_id
        AND c.owner_user_id = auth.uid()
    )
  );

-- Insert only when the owner has an active membership linking that character to the project.
CREATE POLICY "Owners insert adventure arcs for active memberships"
  ON public.character_adventure_arcs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.characters c
      WHERE c.id = character_adventure_arcs.character_id
        AND c.owner_user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = character_adventure_arcs.project_id
        AND pm.character_id = character_adventure_arcs.character_id
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

-- Owner may update developments/status/summary; identity columns stay fixed via trigger.
CREATE POLICY "Owners update character adventure arcs"
  ON public.character_adventure_arcs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.characters c
      WHERE c.id = character_adventure_arcs.character_id
        AND c.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.characters c
      WHERE c.id = character_adventure_arcs.character_id
        AND c.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Owners delete character adventure arcs"
  ON public.character_adventure_arcs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.characters c
      WHERE c.id = character_adventure_arcs.character_id
        AND c.owner_user_id = auth.uid()
    )
  );

-- Active project members can read arcs for that project (shared table view).
CREATE POLICY "Active project members read adventure arcs"
  ON public.character_adventure_arcs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = character_adventure_arcs.project_id
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    )
  );

CREATE OR REPLACE FUNCTION public.set_character_adventure_arcs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_character_adventure_arc_retarget()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.character_id IS DISTINCT FROM OLD.character_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'character_adventure_arcs.character_id and project_id are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_character_adventure_arcs_updated_at ON public.character_adventure_arcs;
CREATE TRIGGER trg_character_adventure_arcs_updated_at
  BEFORE UPDATE ON public.character_adventure_arcs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_character_adventure_arcs_updated_at();

DROP TRIGGER IF EXISTS trg_character_adventure_arcs_no_retarget ON public.character_adventure_arcs;
CREATE TRIGGER trg_character_adventure_arcs_no_retarget
  BEFORE UPDATE ON public.character_adventure_arcs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_character_adventure_arc_retarget();

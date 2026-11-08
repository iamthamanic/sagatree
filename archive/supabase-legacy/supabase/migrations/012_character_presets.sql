-- Character presets: versioned full-sheet snapshots (owner-only). SagaDrive Core MVP.

CREATE TABLE IF NOT EXISTS public.character_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  ruleset_key TEXT NOT NULL DEFAULT 'sagadrive-core'
    CHECK (ruleset_key IN ('sagadrive-core', 'dnd-5.5e')),
  origin TEXT NOT NULL DEFAULT 'user'
    CHECK (origin IN ('user', 'system')),
  source_character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_character_presets_owner
  ON public.character_presets(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_character_presets_source_character
  ON public.character_presets(source_character_id)
  WHERE source_character_id IS NOT NULL;

COMMENT ON TABLE public.character_presets IS
  'Owner-scoped character sheet presets with append-only Level versions (JSONB snapshots).';

COMMENT ON COLUMN public.character_presets.versions IS
  'Ordered list of {level, snapshot, created_at}. Append-only; no replace of existing levels.';

COMMENT ON COLUMN public.character_presets.published IS
  'Marketplace flag; MVP always false (no public read policy).';

ALTER TABLE public.character_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners select own character presets"
  ON public.character_presets
  FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "Owners insert own character presets"
  ON public.character_presets
  FOR INSERT
  WITH CHECK (owner_user_id = auth.uid() AND published = FALSE);

CREATE POLICY "Owners update own character presets"
  ON public.character_presets
  FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid() AND published = FALSE);

CREATE POLICY "Owners delete own character presets"
  ON public.character_presets
  FOR DELETE
  USING (owner_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_character_presets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_character_preset_owner_retarget()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'character_presets.owner_user_id is immutable';
  END IF;
  IF NEW.published IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'character_presets.published must remain false in MVP';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_character_presets_updated_at ON public.character_presets;
CREATE TRIGGER trg_character_presets_updated_at
  BEFORE UPDATE ON public.character_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_character_presets_updated_at();

DROP TRIGGER IF EXISTS trg_character_presets_no_retarget ON public.character_presets;
CREATE TRIGGER trg_character_presets_no_retarget
  BEFORE UPDATE ON public.character_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_character_preset_owner_retarget();

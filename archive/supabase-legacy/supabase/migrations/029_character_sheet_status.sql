-- 029_character_sheet_status.sql
-- Allow incomplete character drafts: complete | incomplete.
-- Existing rows default to complete (prior saves required full validation).

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS sheet_status TEXT NOT NULL DEFAULT 'complete';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'characters_sheet_status_check'
  ) THEN
    ALTER TABLE public.characters
      ADD CONSTRAINT characters_sheet_status_check
      CHECK (sheet_status IN ('complete', 'incomplete'));
  END IF;
END $$;

COMMENT ON COLUMN public.characters.sheet_status IS
  'complete = full SagaDrive build valid; incomplete = draft allowed with gaps';

-- Persist SagaDrive Core character-creation metadata without coupling the generic
-- character table to one ruleset. Existing characters are normalized in the app.

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS sagadrive_profile JSONB;

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.characters.sagadrive_profile IS
  'SagaDrive Core creation metadata such as essence, species traits, background choices, Drive and Momentum.';

COMMENT ON COLUMN public.characters.notes IS
  'User-authored free-form character notes.';

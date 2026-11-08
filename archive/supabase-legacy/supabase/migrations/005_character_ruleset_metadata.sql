-- Persist the editor's stable ruleset identity and D&D 5.5e background separately
-- from free-form character lore. Existing characters default to SagaDrive Core.

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS ruleset_key TEXT NOT NULL DEFAULT 'sagadrive-core';

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS dnd_background TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'characters_ruleset_key_check'
      AND conrelid = 'public.characters'::regclass
  ) THEN
    ALTER TABLE public.characters
      ADD CONSTRAINT characters_ruleset_key_check
      CHECK (ruleset_key IN ('sagadrive-core', 'dnd-5.5e'));
  END IF;
END;
$$;

-- SagaDrive Core has no D&D background. Clear impossible combinations instead of
-- carrying stale D&D metadata after a ruleset switch.
UPDATE public.characters
SET dnd_background = NULL
WHERE ruleset_key <> 'dnd-5.5e'
  AND dnd_background IS NOT NULL;

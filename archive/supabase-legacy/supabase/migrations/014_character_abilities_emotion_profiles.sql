-- 014_character_abilities_emotion_profiles.sql
-- Character editor persists rule-bound abilities and emotion profiles as JSONB.
-- These columns were referenced by CharacterDto / supabase-character.repository
-- but never added in 001–013, so POST/PATCH to characters failed with PGRST204.

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS abilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS emotion_profiles JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.characters.abilities IS
  'Rule-bound character abilities (JSONB array). Empty for SagaDrive Core until powers are unlocked.';

COMMENT ON COLUMN public.characters.emotion_profiles IS
  'Optional emotion/mood profiles for roleplay tooling (JSONB array).';

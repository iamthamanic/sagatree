-- 038: Persist Body Family Compatibility recommendation on artifacts (#253).

ALTER TABLE public.character_avatar_artifacts
  ADD COLUMN IF NOT EXISTS body_profile JSONB,
  ADD COLUMN IF NOT EXISTS family_compatibility JSONB;

COMMENT ON COLUMN public.character_avatar_artifacts.body_profile IS
  'SagaDriveBodyProfileV1 proportions snapshot.';
COMMENT ON COLUMN public.character_avatar_artifacts.family_compatibility IS
  'FamilyCompatibilityResultV1 (standard|compact|heavy|custom) — never forced under threshold.';

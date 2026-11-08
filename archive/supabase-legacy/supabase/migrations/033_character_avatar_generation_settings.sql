-- Provider-agnostic generation metadata on avatar Meshy jobs.
-- Persists effective settings at generation time (presets may change later).

ALTER TABLE public.character_avatar_meshy_jobs
  ADD COLUMN IF NOT EXISTS provider_id TEXT NOT NULL DEFAULT 'meshy',
  ADD COLUMN IF NOT EXISTS provider_model TEXT,
  ADD COLUMN IF NOT EXISTS preset_id TEXT,
  ADD COLUMN IF NOT EXISTS preset_version INTEGER,
  ADD COLUMN IF NOT EXISTS generation_settings JSONB,
  ADD COLUMN IF NOT EXISTS master_storage_path TEXT;

COMMENT ON COLUMN public.character_avatar_meshy_jobs.provider_id IS
  '3D generation provider id (meshy, later tripo, …).';
COMMENT ON COLUMN public.character_avatar_meshy_jobs.generation_settings IS
  'Frozen SagaDriveAvatar3dGenerationV1 record: preset + effective settings + mapped vendor params.';
COMMENT ON COLUMN public.character_avatar_meshy_jobs.master_storage_path IS
  'Optional high-detail master GLB before runtime remesh/optimize; storage_path remains runtime.';

ALTER TABLE public.character_avatar_meshy_jobs
  DROP CONSTRAINT IF EXISTS character_avatar_meshy_jobs_provider_id_check;

ALTER TABLE public.character_avatar_meshy_jobs
  ADD CONSTRAINT character_avatar_meshy_jobs_provider_id_check
  CHECK (provider_id ~ '^[a-z][a-z0-9_-]{0,31}$');

-- Character avatar Meshy generation jobs (#10): owner-scoped, idempotent, no capability claims.

CREATE TABLE IF NOT EXISTS public.character_avatar_meshy_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID,
  prompt TEXT NOT NULL CHECK (char_length(trim(prompt)) >= 8 AND char_length(prompt) <= 500),
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN (
      'queued', 'generating', 'rigging', 'analyzing',
      'succeeded', 'failed', 'canceled', 'provider_unavailable'
    )),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  provider_task_id TEXT,
  storage_path TEXT,
  error_message TEXT,
  -- Capabilities are NEVER stored from provider success — #6 owns analysis.
  rig_analysis_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (rig_analysis_status IN ('pending', 'ready', 'limited', 'failed', 'unsupported')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_character_avatar_meshy_idempotency
  ON public.character_avatar_meshy_jobs(owner_user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_character_avatar_meshy_owner
  ON public.character_avatar_meshy_jobs(owner_user_id, created_at DESC);

ALTER TABLE public.character_avatar_meshy_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own meshy avatar jobs" ON public.character_avatar_meshy_jobs;
DROP POLICY IF EXISTS "Owners insert own meshy avatar jobs" ON public.character_avatar_meshy_jobs;
DROP POLICY IF EXISTS "Owners update own meshy avatar jobs" ON public.character_avatar_meshy_jobs;

CREATE POLICY "Owners read own meshy avatar jobs"
  ON public.character_avatar_meshy_jobs FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY "Owners insert own meshy avatar jobs"
  ON public.character_avatar_meshy_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND rig_analysis_status = 'pending'
  );

CREATE POLICY "Owners update own meshy avatar jobs"
  ON public.character_avatar_meshy_jobs FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

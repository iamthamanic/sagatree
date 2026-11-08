-- Item model3d assets (#141): private GLB storage, manifests, Image-to-3D jobs, rate limits.
-- Secrets stay in Edge Function env; browser never holds MESHY_API_KEY.
-- Separate from thumbnail (#140) — Library/Inventory must not load 3D.

-- ---------------------------------------------------------------------------
-- 1. Storage bucket (GLB only, 50 MB)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) VALUES (
  'item-models',
  'item-models',
  false,
  52428800,
  ARRAY['model/gltf-binary']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can upload own item models" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own item models" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own item models" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own item models" ON storage.objects;

-- Paths always start with auth.uid(); world objects use {uid}/world/{worldId}/...
CREATE POLICY "Users can upload own item models"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'item-models'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own item models"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'item-models'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own item models"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'item-models'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'item-models'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own item models"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'item-models'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 2. Asset manifests (durable reference; not Meshy URLs)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.item_model3d_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'model3d' CHECK (kind = 'model3d'),
  definition_id TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  world_profile_id UUID REFERENCES public.world_profiles(id) ON DELETE CASCADE,
  mime TEXT NOT NULL CHECK (mime = 'model/gltf-binary'),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 52428800),
  storage_path TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('upload', 'meshy')),
  provider_task_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_item_model3d_assets_definition
  ON public.item_model3d_assets(definition_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_model3d_assets_owner
  ON public.item_model3d_assets(owner_user_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.item_model3d_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own item model3d assets" ON public.item_model3d_assets;
DROP POLICY IF EXISTS "Owners insert own item model3d assets" ON public.item_model3d_assets;
DROP POLICY IF EXISTS "Owners update own item model3d assets" ON public.item_model3d_assets;

CREATE POLICY "Owners read own item model3d assets"
  ON public.item_model3d_assets FOR SELECT
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR (
      world_profile_id IS NOT NULL
      AND public.current_user_can_read_world_profile(world_profile_id)
    )
  );

CREATE POLICY "Owners insert own item model3d assets"
  ON public.item_model3d_assets FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND (
      world_profile_id IS NULL
      OR public.current_user_can_edit_world_profile(world_profile_id)
    )
  );

CREATE POLICY "Owners update own item model3d assets"
  ON public.item_model3d_assets FOR UPDATE
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR (
      world_profile_id IS NOT NULL
      AND public.current_user_can_edit_world_profile(world_profile_id)
    )
  )
  WITH CHECK (
    owner_user_id = auth.uid()
    OR (
      world_profile_id IS NOT NULL
      AND public.current_user_can_edit_world_profile(world_profile_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Generation jobs (status recoverable after navigation)
-- Snapshot input thumbnail so mid-job thumbnail replace cannot rewrite provenance.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.item_model3d_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  world_profile_id UUID REFERENCES public.world_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (
    status IN ('queued', 'waiting', 'generating', 'succeeded', 'failed', 'canceled')
  ),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  input_thumbnail_asset_id UUID REFERENCES public.item_thumbnail_assets(id) ON DELETE SET NULL,
  input_provider_task_id TEXT,
  provider_task_id TEXT,
  asset_id UUID REFERENCES public.item_model3d_assets(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_model3d_jobs_definition
  ON public.item_model3d_jobs(definition_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_model3d_jobs_owner_active
  ON public.item_model3d_jobs(owner_user_id, status)
  WHERE status IN ('queued', 'waiting', 'generating');

ALTER TABLE public.item_model3d_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own item model3d jobs" ON public.item_model3d_jobs;
DROP POLICY IF EXISTS "Owners insert own item model3d jobs" ON public.item_model3d_jobs;
DROP POLICY IF EXISTS "Owners update own item model3d jobs" ON public.item_model3d_jobs;

CREATE POLICY "Owners read own item model3d jobs"
  ON public.item_model3d_jobs FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY "Owners insert own item model3d jobs"
  ON public.item_model3d_jobs FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners update own item model3d jobs"
  ON public.item_model3d_jobs FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Persistent rate limit (service_role RPC only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.item_model3d_rate_limits (
  user_id UUID PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.item_model3d_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.item_model3d_rate_limits FROM PUBLIC;
REVOKE ALL ON TABLE public.item_model3d_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_item_model3d_rate_limit(
  p_user_id UUID,
  p_limit INTEGER,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_count INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_limit < 1 OR p_limit > 60 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 60';
  END IF;

  IF p_window_seconds < 1 OR p_window_seconds > 3600 THEN
    RAISE EXCEPTION 'p_window_seconds must be between 1 and 3600';
  END IF;

  INSERT INTO public.item_model3d_rate_limits AS limits (
    user_id,
    window_started_at,
    request_count,
    updated_at
  )
  VALUES (p_user_id, v_now, 1, v_now)
  ON CONFLICT (user_id) DO UPDATE
  SET
    window_started_at = CASE
      WHEN limits.window_started_at <= v_now - (p_window_seconds * INTERVAL '1 second') THEN v_now
      ELSE limits.window_started_at
    END,
    request_count = CASE
      WHEN limits.window_started_at <= v_now - (p_window_seconds * INTERVAL '1 second') THEN 1
      ELSE LEAST(limits.request_count + 1, p_limit + 1)
    END,
    updated_at = v_now
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_item_model3d_rate_limit(UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_item_model3d_rate_limit(UUID, INTEGER, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_item_model3d_rate_limit(UUID, INTEGER, INTEGER) TO service_role;

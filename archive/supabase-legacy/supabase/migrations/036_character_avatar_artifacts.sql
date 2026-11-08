-- 036: Avatar V2 source-neutral artifacts (#251).
-- Canonical owner-scoped AvatarArtifact; legacy import/meshy rows stay readable via FKs.
-- Client cannot escalate analysis_status / origin; incomplete rows cannot activate.

CREATE TABLE IF NOT EXISTS public.character_avatar_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID,
  origin TEXT NOT NULL
    CHECK (origin IN ('sagadrive', 'import', 'generate')),
  asset_key TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  format TEXT NOT NULL
    CHECK (format IN ('vrm', 'glb', 'template')),
  analysis_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (analysis_status IN (
      'pending', 'analyzing', 'ready', 'limited', 'failed', 'unsupported'
    )),
  materialization_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (materialization_status IN (
      'draft', 'materialized', 'failed', 'superseded'
    )),
  is_active BOOLEAN NOT NULL DEFAULT false,
  schema_version INTEGER NOT NULL DEFAULT 2
    CHECK (schema_version = 2),
  import_asset_id UUID REFERENCES public.character_avatar_import_assets(id) ON DELETE SET NULL,
  generate_job_id UUID REFERENCES public.character_avatar_meshy_jobs(id) ON DELETE SET NULL,
  template_id TEXT,
  provider_id TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT character_avatar_artifacts_asset_key_logical
    CHECK (asset_key LIKE 'avatar-asset:%' AND asset_key NOT LIKE '%://%'),
  CONSTRAINT character_avatar_artifacts_storage_no_url
    CHECK (storage_path NOT LIKE '%://%' AND storage_path NOT LIKE '/%'),
  CONSTRAINT character_avatar_artifacts_active_requires_materialized
    CHECK (
      is_active = false
      OR (
        materialization_status = 'materialized'
        AND analysis_status <> 'failed'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_character_avatar_artifacts_owner
  ON public.character_avatar_artifacts(owner_user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_character_avatar_artifacts_one_active
  ON public.character_avatar_artifacts(owner_user_id, character_id)
  WHERE is_active = true AND deleted_at IS NULL AND character_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_character_avatar_artifacts_idempotency
  ON public.character_avatar_artifacts(owner_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_character_avatar_artifacts_import_ref
  ON public.character_avatar_artifacts(import_asset_id)
  WHERE import_asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_character_avatar_artifacts_generate_ref
  ON public.character_avatar_artifacts(generate_job_id)
  WHERE generate_job_id IS NOT NULL;

ALTER TABLE public.character_avatar_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own avatar artifacts" ON public.character_avatar_artifacts;
DROP POLICY IF EXISTS "Owners insert own avatar artifacts" ON public.character_avatar_artifacts;
DROP POLICY IF EXISTS "Owners update own avatar artifacts" ON public.character_avatar_artifacts;

CREATE POLICY "Owners read own avatar artifacts"
  ON public.character_avatar_artifacts FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

-- Client may insert only pending/draft-or-materialized inactive rows (no capability escalation).
CREATE POLICY "Owners insert own avatar artifacts"
  ON public.character_avatar_artifacts FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND analysis_status = 'pending'
    AND materialization_status IN ('draft', 'materialized', 'failed')
    AND is_active = false
    AND schema_version = 2
    AND asset_key LIKE 'avatar-asset:' || auth.uid()::text || ':%'
    AND storage_path LIKE auth.uid()::text || '/%'
  );

-- Client UPDATE: ownership + activate only when materialized/non-failed.
-- Analysis/origin escalation is blocked by trigger (trusted statuses may already exist from Analyzer).
CREATE POLICY "Owners update own avatar artifacts"
  ON public.character_avatar_artifacts FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (
    owner_user_id = auth.uid()
    AND (
      is_active = false
      OR (
        materialization_status = 'materialized'
        AND analysis_status <> 'failed'
      )
    )
  );

CREATE OR REPLACE FUNCTION public.guard_character_avatar_artifact_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role / Edge may upgrade analysis; authenticated clients may not.
  IF auth.role() = 'authenticated' THEN
    IF NEW.origin IS DISTINCT FROM OLD.origin THEN
      RAISE EXCEPTION 'avatar artifact origin is immutable for clients';
    END IF;
    IF NEW.asset_key IS DISTINCT FROM OLD.asset_key THEN
      RAISE EXCEPTION 'avatar artifact asset_key is immutable for clients';
    END IF;
    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      RAISE EXCEPTION 'avatar artifact owner is immutable';
    END IF;
    IF NEW.analysis_status IS DISTINCT FROM OLD.analysis_status
       AND NEW.analysis_status NOT IN ('pending', 'failed') THEN
      RAISE EXCEPTION 'avatar artifact analysis_status escalation forbidden';
    END IF;
    IF NEW.analysis_status IN ('ready', 'limited', 'analyzing', 'unsupported')
       AND NEW.analysis_status IS DISTINCT FROM OLD.analysis_status THEN
      RAISE EXCEPTION 'avatar artifact trusted analysis statuses are server-only';
    END IF;
    IF NEW.is_active = true AND NEW.materialization_status <> 'materialized' THEN
      RAISE EXCEPTION 'incomplete avatar artifact cannot be activated';
    END IF;
    IF NEW.is_active = true AND NEW.analysis_status = 'failed' THEN
      RAISE EXCEPTION 'failed avatar artifact cannot be activated';
    END IF;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_character_avatar_artifact_escalation
  ON public.character_avatar_artifacts;

CREATE TRIGGER trg_guard_character_avatar_artifact_escalation
  BEFORE UPDATE ON public.character_avatar_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_character_avatar_artifact_escalation();

COMMENT ON TABLE public.character_avatar_artifacts IS
  'Avatar V2 source-neutral artifacts (#251): owner RLS; analysis escalation server-only; legacy import/generate via FKs.';

COMMENT ON COLUMN public.character_avatar_artifacts.asset_key IS
  'Logical avatar-asset:{owner}:{id} — never a free URL.';

COMMENT ON COLUMN public.character_avatar_artifacts.analysis_status IS
  'Trusted upgrades (ready/limited/…) only via service_role / Analyzer — not browser.';

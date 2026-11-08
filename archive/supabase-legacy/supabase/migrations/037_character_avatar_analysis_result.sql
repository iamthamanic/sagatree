-- 037: Persist versioned Avatar Structure AnalysisResult on artifacts (#252).
-- Trusted analysis writes are service_role / Analyzer only; clients cannot escalate.

ALTER TABLE public.character_avatar_artifacts
  ADD COLUMN IF NOT EXISTS analysis_result JSONB;

COMMENT ON COLUMN public.character_avatar_artifacts.analysis_result IS
  'SagaDriveAvatarStructureAnalyzerV2 payload (authoritative). Browser must not write trusted statuses.';

-- Clients may clear to null or leave unchanged; may not set authoritative ready/limited payloads.
CREATE OR REPLACE FUNCTION public.guard_character_avatar_artifact_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    -- analysis_result: clients may only null it out, never inject authoritative=true
    IF NEW.analysis_result IS DISTINCT FROM OLD.analysis_result
       AND NEW.analysis_result IS NOT NULL THEN
      IF COALESCE((NEW.analysis_result->>'authoritative')::boolean, false) = true THEN
        RAISE EXCEPTION 'client cannot persist authoritative analysis_result';
      END IF;
      IF COALESCE(NEW.analysis_result->>'status', '') IN ('ready', 'limited') THEN
        RAISE EXCEPTION 'client cannot persist trusted analysis_result status';
      END IF;
    END IF;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

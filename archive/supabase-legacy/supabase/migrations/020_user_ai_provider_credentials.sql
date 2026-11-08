-- User AI provider credentials (BYOK): encrypted secrets, owner-scoped via Edge only.
-- Client never SELECTs ciphertext; prod generate uses user keys (host MESHY only with AI_PROVIDER_ALLOW_HOST_KEYS=1).

-- ---------------------------------------------------------------------------
-- 1. Credentials table (service_role only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_ai_provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  secret_ciphertext TEXT NOT NULL,
  key_hint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invalid', 'revoked')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_validated_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_ai_provider_credentials_provider_id_len
    CHECK (char_length(provider_id) >= 2 AND char_length(provider_id) <= 64),
  CONSTRAINT user_ai_provider_credentials_key_hint_len
    CHECK (char_length(key_hint) >= 4 AND char_length(key_hint) <= 32),
  CONSTRAINT user_ai_provider_credentials_unique_user_provider
    UNIQUE (user_id, provider_id)
);

CREATE INDEX IF NOT EXISTS user_ai_provider_credentials_user_idx
  ON public.user_ai_provider_credentials (user_id);

ALTER TABLE public.user_ai_provider_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_ai_provider_credentials FROM PUBLIC;
REVOKE ALL ON TABLE public.user_ai_provider_credentials FROM anon, authenticated;
GRANT ALL ON TABLE public.user_ai_provider_credentials TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Rate limits for credential upsert / refresh (service_role RPC only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_provider_credential_rate_limits (
  user_id UUID PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_provider_credential_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_provider_credential_rate_limits FROM PUBLIC;
REVOKE ALL ON TABLE public.ai_provider_credential_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_ai_provider_credential_rate_limit(
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

  INSERT INTO public.ai_provider_credential_rate_limits AS limits (
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

REVOKE ALL ON FUNCTION public.consume_ai_provider_credential_rate_limit(UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_ai_provider_credential_rate_limit(UUID, INTEGER, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_provider_credential_rate_limit(UUID, INTEGER, INTEGER) TO service_role;

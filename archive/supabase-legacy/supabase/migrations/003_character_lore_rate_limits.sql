-- Persistent, cross-instance quota for Character Lore generation.
-- One bounded row per authenticated user; only the service_role RPC may consume it.

CREATE TABLE IF NOT EXISTS public.character_lore_rate_limits (
  user_id UUID PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.character_lore_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.character_lore_rate_limits FROM PUBLIC;
REVOKE ALL ON TABLE public.character_lore_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_character_lore_rate_limit(
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

  INSERT INTO public.character_lore_rate_limits AS limits (
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

REVOKE ALL ON FUNCTION public.consume_character_lore_rate_limit(UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_character_lore_rate_limit(UUID, INTEGER, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_character_lore_rate_limit(UUID, INTEGER, INTEGER) TO service_role;

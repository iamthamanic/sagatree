-- MIG-402 (#818): user AI provider credentials + rate limits (host SQLite).
-- Module ownership: ai.

CREATE TABLE IF NOT EXISTS user_ai_provider_credentials (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  secret_ciphertext TEXT NOT NULL,
  key_hint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invalid', 'revoked')),
  added_at TEXT NOT NULL,
  last_validated_at TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, provider_id)
) STRICT;

CREATE INDEX IF NOT EXISTS user_ai_provider_credentials_user_idx
  ON user_ai_provider_credentials (user_id);

CREATE TABLE IF NOT EXISTS ai_provider_credential_rate_limits (
  user_id TEXT NOT NULL PRIMARY KEY,
  window_started_at TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TEXT NOT NULL
) STRICT;

-- MIG-501 optional resumable (tus-style) large uploads.
-- Sessions bind upload id → owner; bytes stage under dataDir/assets/.uploads/.

CREATE TABLE IF NOT EXISTS asset_upload_sessions (
  id TEXT NOT NULL PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  upload_length INTEGER NOT NULL CHECK (upload_length > 0),
  byte_offset INTEGER NOT NULL DEFAULT 0 CHECK (byte_offset >= 0),
  storage_key TEXT NOT NULL UNIQUE,
  finalized_asset_id TEXT,
  created_at TEXT NOT NULL,
  CHECK (byte_offset <= upload_length),
  CHECK (finalized_asset_id IS NULL OR length(finalized_asset_id) > 0)
) STRICT;

CREATE INDEX IF NOT EXISTS asset_upload_sessions_owner_idx
  ON asset_upload_sessions (owner_user_id);

-- MIG-500 local protected assets (metadata; bytes live under dataDir/assets/).
-- Module ownership: assets → media (bytes via asset store adapter).

CREATE TABLE IF NOT EXISTS assets (
  id TEXT NOT NULL PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  checksum_sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  published INTEGER NOT NULL CHECK (published IN (0, 1)),
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS assets_owner_user_id_idx ON assets (owner_user_id);
CREATE INDEX IF NOT EXISTS assets_published_idx ON assets (published);

-- RPC-SAGA-AUTHORING (#871): saga definitions + versioned drafts/publishes.
-- Module ownership: saga.

CREATE TABLE IF NOT EXISTS saga_definitions (
  id TEXT NOT NULL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  synopsis TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL CHECK (origin IN ('native', 'user', 'private_backfill')),
  owner_user_id TEXT,
  draft_revision INTEGER NOT NULL DEFAULT 0 CHECK (draft_revision >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (origin = 'native' AND owner_user_id IS NULL)
    OR (origin <> 'native')
  )
) STRICT;

CREATE TABLE IF NOT EXISTS saga_definition_versions (
  id TEXT NOT NULL PRIMARY KEY,
  saga_id TEXT NOT NULL REFERENCES saga_definitions (id) ON DELETE CASCADE,
  version_label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  payload TEXT NOT NULL,
  published_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (saga_id, version_label)
) STRICT;

CREATE INDEX IF NOT EXISTS saga_definitions_owner_idx ON saga_definitions (owner_user_id);
CREATE INDEX IF NOT EXISTS saga_definition_versions_saga_idx ON saga_definition_versions (saga_id);
CREATE INDEX IF NOT EXISTS saga_definition_versions_status_idx ON saga_definition_versions (saga_id, status);

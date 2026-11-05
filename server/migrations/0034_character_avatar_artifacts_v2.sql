-- CUT-11 / #1146: expand character_avatar_artifacts to Avatar V2 (Postgres 036+037 parity).
-- Rebuild: stub MIG-302 schema cannot ALTER character_id to nullable.

PRAGMA foreign_keys = OFF;

DROP TRIGGER IF EXISTS character_avatar_artifacts_owner_guard_ins;
DROP TRIGGER IF EXISTS character_avatar_artifacts_owner_guard_upd;

CREATE TABLE character_avatar_artifacts_v2 (
  id TEXT NOT NULL PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  character_id TEXT REFERENCES characters(id) ON DELETE CASCADE,
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
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  schema_version INTEGER NOT NULL DEFAULT 2 CHECK (schema_version = 2),
  import_asset_id TEXT,
  generate_job_id TEXT,
  template_id TEXT,
  provider_id TEXT,
  idempotency_key TEXT,
  analysis_result TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CONSTRAINT character_avatar_artifacts_asset_key_logical
    CHECK (asset_key LIKE 'avatar-asset:%' AND asset_key NOT LIKE '%://%'),
  CONSTRAINT character_avatar_artifacts_storage_no_url
    CHECK (storage_path NOT LIKE '%://%' AND storage_path NOT LIKE '/%'),
  CONSTRAINT character_avatar_artifacts_active_requires_materialized
    CHECK (
      is_active = 0
      OR (
        materialization_status = 'materialized'
        AND analysis_status <> 'failed'
      )
    )
) STRICT;

INSERT INTO character_avatar_artifacts_v2 (
  id, owner_user_id, character_id, origin, asset_key, storage_path, format,
  analysis_status, materialization_status, is_active, schema_version,
  created_at, updated_at
)
SELECT
  id,
  owner_user_id,
  character_id,
  'import',
  printf('avatar-asset:%s:%s', owner_user_id, id),
  storage_path,
  'glb',
  'pending',
  'materialized',
  0,
  2,
  created_at,
  created_at
FROM character_avatar_artifacts;

DROP TABLE character_avatar_artifacts;
ALTER TABLE character_avatar_artifacts_v2 RENAME TO character_avatar_artifacts;

CREATE INDEX IF NOT EXISTS character_avatar_artifacts_owner_idx
  ON character_avatar_artifacts (owner_user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS character_avatar_artifacts_character_idx
  ON character_avatar_artifacts (character_id)
  WHERE character_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS character_avatar_artifacts_one_active_uidx
  ON character_avatar_artifacts (owner_user_id, character_id)
  WHERE is_active = 1 AND deleted_at IS NULL AND character_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS character_avatar_artifacts_idempotency_uidx
  ON character_avatar_artifacts (owner_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

-- Nullable character_id allowed; when set, owner must match characters.owner_user_id.
CREATE TRIGGER IF NOT EXISTS character_avatar_artifacts_owner_guard_ins
BEFORE INSERT ON character_avatar_artifacts
FOR EACH ROW
WHEN NEW.character_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'foreign-character-owner')
  WHERE NOT EXISTS (
    SELECT 1 FROM characters c
    WHERE c.id = NEW.character_id
      AND c.owner_user_id = NEW.owner_user_id
      AND c.deleted_at IS NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS character_avatar_artifacts_owner_guard_upd
BEFORE UPDATE OF character_id, owner_user_id ON character_avatar_artifacts
FOR EACH ROW
WHEN NEW.character_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'foreign-character-owner')
  WHERE NOT EXISTS (
    SELECT 1 FROM characters c
    WHERE c.id = NEW.character_id
      AND c.owner_user_id = NEW.owner_user_id
      AND c.deleted_at IS NULL
  );
END;

PRAGMA foreign_keys = ON;

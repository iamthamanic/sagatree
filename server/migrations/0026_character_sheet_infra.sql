-- MIG-302 character sheet host infra (#801). Module ownership: character.
-- Extends minimal membership characters table for owner-scoped CRUD / presets.
-- Soft-delete via deleted_at; sheet body as JSON for isolated-contract parity.

ALTER TABLE characters ADD COLUMN updated_at TEXT;
ALTER TABLE characters ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE characters ADD COLUMN level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1);
ALTER TABLE characters ADD COLUMN sheet_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE characters ADD COLUMN portrait_storage_path TEXT;
ALTER TABLE characters ADD COLUMN deleted_at TEXT;

UPDATE characters
  SET updated_at = COALESCE(updated_at, created_at)
  WHERE updated_at IS NULL;

CREATE TABLE IF NOT EXISTS character_presets (
  id TEXT NOT NULL PRIMARY KEY,
  public_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'owner')),
  owner_user_id TEXT,
  sheet_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS character_presets_public_id_uidx
  ON character_presets (public_id);
CREATE UNIQUE INDEX IF NOT EXISTS character_presets_slug_uidx
  ON character_presets (slug);
CREATE INDEX IF NOT EXISTS character_presets_visibility_idx
  ON character_presets (visibility);

CREATE TABLE IF NOT EXISTS character_avatar_artifacts (
  id TEXT NOT NULL PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'artifact',
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS character_avatar_artifacts_owner_idx
  ON character_avatar_artifacts (owner_user_id);
CREATE INDEX IF NOT EXISTS character_avatar_artifacts_character_idx
  ON character_avatar_artifacts (character_id);

-- CUT-08 / #1143: product character presets (versions JSON, origin, source character).
-- Extends MIG-302 character_presets without replacing slug/visibility seed contract.

ALTER TABLE character_presets ADD COLUMN ruleset_key TEXT NOT NULL DEFAULT 'sagatree-core';
ALTER TABLE character_presets ADD COLUMN origin TEXT NOT NULL DEFAULT 'system';
ALTER TABLE character_presets ADD COLUMN source_character_id TEXT;
ALTER TABLE character_presets ADD COLUMN published INTEGER NOT NULL DEFAULT 0;
ALTER TABLE character_presets ADD COLUMN versions_json TEXT NOT NULL DEFAULT '[]';

-- Existing seed rows stay origin=system (readable via visibility). Product CRUD uses origin=user.
UPDATE character_presets
SET origin = 'system'
WHERE owner_user_id IS NULL AND (origin IS NULL OR origin = '' OR origin = 'system');

CREATE INDEX IF NOT EXISTS character_presets_owner_origin_idx
  ON character_presets (owner_user_id, origin, created_at DESC);

CREATE INDEX IF NOT EXISTS character_presets_source_character_idx
  ON character_presets (source_character_id)
  WHERE source_character_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS character_presets_owner_source_uidx
  ON character_presets (owner_user_id, source_character_id)
  WHERE origin = 'user' AND source_character_id IS NOT NULL;

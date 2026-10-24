-- MIG-309 ruleset catalog (host SQLite). Module ownership: rulesets → rulesets.
-- Catalog shape mirrors src/domains/rules/ruleset-catalog (not early project-scoped stub).

CREATE TABLE IF NOT EXISTS rulesets (
  id TEXT NOT NULL PRIMARY KEY,
  creator_user_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT,
  attributes_config_json TEXT NOT NULL,
  skills_config_json TEXT NOT NULL,
  classes_config_json TEXT NOT NULL,
  races_config_json TEXT NOT NULL,
  combat_rules_json TEXT NOT NULL,
  dice_rules_json TEXT NOT NULL,
  level_progression_json TEXT NOT NULL,
  is_official INTEGER NOT NULL CHECK (is_official IN (0, 1)),
  is_public INTEGER NOT NULL CHECK (is_public IN (0, 1)),
  is_marketplace_item INTEGER NOT NULL CHECK (is_marketplace_item IN (0, 1)),
  downloads_count INTEGER NOT NULL DEFAULT 0,
  rating REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS rulesets_is_official_name_idx ON rulesets (is_official DESC, name);
CREATE INDEX IF NOT EXISTS rulesets_creator_user_id_idx ON rulesets (creator_user_id);

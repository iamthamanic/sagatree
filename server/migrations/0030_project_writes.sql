-- FE-HOST-12 (#1117): project write columns + session look override.
-- Module ownership: projects → project; play_sessions → session.

ALTER TABLE projects ADD COLUMN updated_at TEXT;
ALTER TABLE projects ADD COLUMN default_look_profile_id TEXT;
ALTER TABLE projects ADD COLUMN allow_player_character_look_override INTEGER NOT NULL DEFAULT 1
  CHECK (allow_player_character_look_override IN (0, 1));

UPDATE projects
SET updated_at = created_at
WHERE updated_at IS NULL;

ALTER TABLE play_sessions ADD COLUMN look_profile_id TEXT;

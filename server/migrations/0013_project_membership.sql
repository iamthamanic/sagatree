-- RPC-PROJECT-MEMBERSHIP (#874): project join codes + member character binding.
-- Postgres parity: projects.code (8-char), project_members.id/character_id; minimal characters for ownership checks.

ALTER TABLE projects ADD COLUMN code TEXT;

-- Backfill join codes for pre-existing active projects (upgrade path).
UPDATE projects
SET code = upper(substr(hex(randomblob(4)), 1, 8))
WHERE (code IS NULL OR TRIM(code) = '')
  AND status = 'active';

-- Normalized uniqueness matches lookup UPPER(TRIM(code)) (Postgres idx_projects_code_casefold_unique).
CREATE UNIQUE INDEX IF NOT EXISTS projects_code_norm_unique
  ON projects (UPPER(TRIM(code)))
  WHERE code IS NOT NULL AND TRIM(code) <> '';

ALTER TABLE project_members ADD COLUMN id TEXT;
ALTER TABLE project_members ADD COLUMN character_id TEXT;

-- Backfill member ids for rows created before this slice.
UPDATE project_members
SET id = lower(hex(randomblob(4)) || hex(randomblob(2)) || '4' || substr(hex(randomblob(2)), 2) ||
               substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || hex(randomblob(6)))
WHERE id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS project_members_id_unique
  ON project_members (id)
  WHERE id IS NOT NULL;

-- Minimal durable PC rows for membership ownership / sheet_status (character module).
CREATE TABLE IF NOT EXISTS characters (
  id TEXT NOT NULL PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  character_type TEXT NOT NULL DEFAULT 'pc' CHECK (character_type IN ('pc', 'npc', 'gm_presence')),
  sheet_status TEXT NOT NULL DEFAULT 'complete' CHECK (sheet_status IN ('complete', 'incomplete', 'draft')),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS characters_owner_user_id_idx ON characters (owner_user_id);

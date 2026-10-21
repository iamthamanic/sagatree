-- MIG-011 bootstrap catalog (approved minimal host schema).
-- Postgres→SQLite mappings: UUID→TEXT, timestamptz→TEXT ISO-8601, jsonb→TEXT JSON, boolean→INTEGER 0/1.
-- Module ownership: schema_migrations→ops; worlds→world; projects+project_members→project.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER NOT NULL PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS worlds (
  id TEXT NOT NULL PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS worlds_owner_user_id_idx ON worlds (owner_user_id);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT NOT NULL PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds (id),
  gm_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS projects_world_id_idx ON projects (world_id);

CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects (id),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  joined_at TEXT,
  PRIMARY KEY (project_id, user_id)
) STRICT;

CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON project_members (user_id);

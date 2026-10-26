-- RPC-NPC-INSTANCES (#877): definitions, controller assignments, session instances.
-- Module ownership: npc_creature_* → npc-creature.

CREATE TABLE IF NOT EXISTS npc_creature_definitions (
  id TEXT NOT NULL PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal', 'world', 'core', 'builtin')),
  owner_user_id TEXT,
  world_profile_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS npc_creature_controller_assignments (
  project_id TEXT NOT NULL REFERENCES projects (id),
  definition_id TEXT NOT NULL,
  controller_user_id TEXT,
  assigned_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, definition_id)
) STRICT;

CREATE TABLE IF NOT EXISTS npc_creature_instances (
  id TEXT NOT NULL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id),
  session_id TEXT REFERENCES play_sessions (session_id),
  definition_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  instance_kind TEXT NOT NULL CHECK (instance_kind IN ('generic', 'persistent')),
  sequence_number INTEGER NOT NULL CHECK (sequence_number >= 1),
  snapshot TEXT NOT NULL,
  runtime TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS npc_creature_instances_project_idx
  ON npc_creature_instances (project_id);
CREATE INDEX IF NOT EXISTS npc_creature_instances_session_idx
  ON npc_creature_instances (session_id)
  WHERE session_id IS NOT NULL;

-- MIG-022 SessionRuntimeState (GATE-04 single-writer semantics).
-- Module ownership: session_runtime / session_members / command_idempotency / session_events → session.

CREATE TABLE IF NOT EXISTS session_runtime (
  session_id TEXT NOT NULL PRIMARY KEY,
  project_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  state_json TEXT NOT NULL CHECK (json_valid(state_json)),
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS session_runtime_project_id_idx ON session_runtime (project_id);

CREATE TABLE IF NOT EXISTS session_members (
  session_id TEXT NOT NULL REFERENCES session_runtime (session_id),
  actor_user_id TEXT NOT NULL,
  can_write INTEGER NOT NULL CHECK (can_write IN (0, 1)),
  PRIMARY KEY (session_id, actor_user_id)
) STRICT;

CREATE INDEX IF NOT EXISTS session_members_actor_user_id_idx ON session_members (actor_user_id);

CREATE TABLE IF NOT EXISTS command_idempotency (
  session_id TEXT NOT NULL REFERENCES session_runtime (session_id),
  idempotency_key TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  PRIMARY KEY (session_id, idempotency_key)
) STRICT;

CREATE TABLE IF NOT EXISTS session_events (
  session_id TEXT NOT NULL REFERENCES session_runtime (session_id),
  event_sequence INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  actor_user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  PRIMARY KEY (session_id, event_sequence),
  UNIQUE (session_id, revision),
  UNIQUE (session_id, idempotency_key)
) STRICT;

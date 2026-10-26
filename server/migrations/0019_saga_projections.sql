-- RPC-SAGA-PROJECTIONS (#876): outcome promotion ledger + world lore payload.
-- Promote events append at current runtime revision without bumping it (PG parity),
-- so drop UNIQUE(session_id, revision) which blocked multi-event audits at one rev.
CREATE TABLE session_events_revfix (
  session_id TEXT NOT NULL REFERENCES session_runtime (session_id),
  event_sequence INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  actor_user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  PRIMARY KEY (session_id, event_sequence),
  UNIQUE (session_id, idempotency_key)
) STRICT;
INSERT INTO session_events_revfix
  SELECT session_id, event_sequence, revision, actor_user_id, idempotency_key, payload_json
  FROM session_events;
DROP TABLE session_events;
ALTER TABLE session_events_revfix RENAME TO session_events;

CREATE TABLE IF NOT EXISTS session_outcome_promotions (
  id TEXT NOT NULL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES play_sessions (session_id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (project_id, source_kind, source_id, target_kind)
) STRICT;

CREATE INDEX IF NOT EXISTS session_outcome_promotions_session_idx
  ON session_outcome_promotions (session_id);

ALTER TABLE worlds ADD COLUMN payload TEXT NOT NULL DEFAULT '{}';

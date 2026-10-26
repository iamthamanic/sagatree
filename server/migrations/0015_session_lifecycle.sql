-- RPC-SESSION-LIFECYCLE (#868): session numbers, names, revision, terminal timestamps,
-- world_state knowledge carry, and completion recaps (internal writer only).

ALTER TABLE play_sessions ADD COLUMN session_number INTEGER;
ALTER TABLE play_sessions ADD COLUMN name TEXT;
ALTER TABLE play_sessions ADD COLUMN notes TEXT;
ALTER TABLE play_sessions ADD COLUMN world_state TEXT NOT NULL DEFAULT '{}';
ALTER TABLE play_sessions ADD COLUMN runtime_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE play_sessions ADD COLUMN started_at TEXT;
ALTER TABLE play_sessions ADD COLUMN ended_at TEXT;
ALTER TABLE play_sessions ADD COLUMN updated_at TEXT;

-- Backfill session numbers per project by created_at order.
WITH ranked AS (
  SELECT session_id,
         ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at, session_id) AS n
  FROM play_sessions
)
UPDATE play_sessions
SET session_number = (
  SELECT n FROM ranked WHERE ranked.session_id = play_sessions.session_id
)
WHERE session_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS play_sessions_project_number_uidx
  ON play_sessions (project_id, session_number)
  WHERE session_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS session_recaps (
  session_id TEXT NOT NULL PRIMARY KEY REFERENCES play_sessions (session_id) ON DELETE CASCADE,
  summary_text TEXT,
  highlight_lines TEXT NOT NULL DEFAULT '[]',
  snapshot TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

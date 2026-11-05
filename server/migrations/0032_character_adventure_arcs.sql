-- CUT-09 / #1144: character-owned adventure arcs + developments JSON.
-- Module ownership: character. Membership/session enrichment via public ports only.

CREATE TABLE IF NOT EXISTS character_adventure_arcs (
  id TEXT NOT NULL PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'left')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  summary TEXT,
  developments_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS character_adventure_arcs_character_project_uidx
  ON character_adventure_arcs (character_id, project_id);

CREATE INDEX IF NOT EXISTS character_adventure_arcs_character_started_idx
  ON character_adventure_arcs (character_id, started_at DESC);

CREATE INDEX IF NOT EXISTS character_adventure_arcs_project_idx
  ON character_adventure_arcs (project_id);

-- MIG-023 session invites + join codes (opaque credentials; never authorization).
-- Module ownership: play_sessions / session_invites / session_players → session;
-- project_members remains project-owned (writes only via invite join ensuring player role).

CREATE TABLE IF NOT EXISTS play_sessions (
  session_id TEXT NOT NULL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id),
  public_id TEXT NOT NULL UNIQUE,
  join_code TEXT,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'waiting', 'active', 'paused', 'completed')),
  created_at TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS play_sessions_join_code_uidx
  ON play_sessions (join_code)
  WHERE join_code IS NOT NULL AND join_code <> '';

CREATE INDEX IF NOT EXISTS play_sessions_project_id_idx ON play_sessions (project_id);

CREATE TABLE IF NOT EXISTS session_invites (
  id TEXT NOT NULL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES play_sessions (session_id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_resolved_at TEXT,
  redeem_count INTEGER NOT NULL CHECK (redeem_count >= 0),
  max_redemptions INTEGER CHECK (max_redemptions IS NULL OR max_redemptions > 0)
) STRICT;

CREATE INDEX IF NOT EXISTS session_invites_session_id_idx
  ON session_invites (session_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS session_players (
  session_id TEXT NOT NULL REFERENCES play_sessions (session_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  character_id TEXT,
  is_online INTEGER NOT NULL CHECK (is_online IN (0, 1)),
  left_at TEXT,
  PRIMARY KEY (session_id, user_id)
) STRICT;

CREATE INDEX IF NOT EXISTS session_players_user_id_idx ON session_players (user_id);

-- MIG-304 LookProfile persistence (host SQLite). Module ownership: look.
-- Mirrors supabase/migrations/046_look_profiles.sql + 084 public_id (LK-XXXXX).
-- Append-only versions; archive via status (no DELETE).

CREATE TABLE IF NOT EXISTS look_profiles (
  id TEXT NOT NULL PRIMARY KEY,
  public_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  owner_scope TEXT NOT NULL CHECK (
    owner_scope IN ('system', 'saga', 'session', 'player-character')
  ),
  current_version INTEGER NOT NULL CHECK (current_version >= 1),
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS look_profiles_public_id_uidx
  ON look_profiles (public_id);

CREATE INDEX IF NOT EXISTS look_profiles_owner_status_idx
  ON look_profiles (owner_user_id, status);

CREATE INDEX IF NOT EXISTS look_profiles_updated_idx
  ON look_profiles (updated_at DESC);

CREATE TABLE IF NOT EXISTS look_profile_versions (
  profile_id TEXT NOT NULL REFERENCES look_profiles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  source TEXT NOT NULL CHECK (
    source IN ('manual', 'preset', 'reference-analysis', 'imported')
  ),
  display_name TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  execution_modes_json TEXT NOT NULL,
  look_references_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, version)
) STRICT;

CREATE INDEX IF NOT EXISTS look_profile_versions_profile_idx
  ON look_profile_versions (profile_id, version DESC);

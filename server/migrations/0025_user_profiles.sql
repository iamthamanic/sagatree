-- MIG-312 user_profiles persistence (host SQLite). Module ownership: user-profile.
-- Mirrors supabase/migrations/081_user_profiles_and_avatars.sql table shape (no auth FK on host).
-- Avatar bytes live under dataDir/user-avatars/ (bucket parity); path is not authorization.

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT NOT NULL PRIMARY KEY,
  display_name TEXT,
  avatar_path TEXT,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS user_profiles_updated_idx
  ON user_profiles (updated_at DESC);

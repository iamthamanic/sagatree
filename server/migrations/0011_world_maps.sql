-- RPC-WORLD-MAP (#861): legacy tile map payload per world (host worlds.id ≈ world_profile_id).
-- Table owned by module `world`.

CREATE TABLE IF NOT EXISTS world_maps (
  world_id TEXT NOT NULL PRIMARY KEY REFERENCES worlds (id),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  map_data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT
) STRICT;

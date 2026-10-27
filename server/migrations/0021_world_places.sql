-- RPC-WORLD-PLACES (#863): full world_places + world_place_map_links schema
-- (expand 0020 stub tables to Postgres 095/103 parity).

PRAGMA foreign_keys = OFF;

CREATE TABLE world_places_v21 (
  id TEXT NOT NULL PRIMARY KEY,
  world_profile_id TEXT NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  parent_place_id TEXT REFERENCES world_places_v21 (id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'site',
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'canonical'
    CHECK (status IN ('placeholder', 'draft', 'canonical', 'archived')),
  seed_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  subtype TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (parent_place_id IS NULL OR parent_place_id <> id)
) STRICT;

INSERT INTO world_places_v21 (
  id, world_profile_id, parent_place_id, kind, name, description, status,
  seed_key, sort_order, revision, subtype, created_at, updated_at
)
SELECT
  id,
  world_profile_id,
  NULL,
  kind,
  name,
  NULL,
  status,
  NULL,
  0,
  0,
  NULL,
  created_at,
  updated_at
FROM world_places;

DROP TABLE world_places;
ALTER TABLE world_places_v21 RENAME TO world_places;

CREATE INDEX IF NOT EXISTS world_places_world_idx
  ON world_places (world_profile_id, sort_order, name);

CREATE INDEX IF NOT EXISTS world_places_parent_idx
  ON world_places (parent_place_id);

CREATE UNIQUE INDEX IF NOT EXISTS world_places_seed_key_uidx
  ON world_places (world_profile_id, seed_key)
  WHERE seed_key IS NOT NULL;

CREATE TABLE world_place_map_links_v21 (
  id TEXT NOT NULL PRIMARY KEY,
  world_profile_id TEXT NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  place_id TEXT NOT NULL REFERENCES world_places (id) ON DELETE CASCADE,
  map_id TEXT NOT NULL REFERENCES world_atlas_maps (id) ON DELETE CASCADE,
  usage TEXT NOT NULL DEFAULT 'overview'
    CHECK (usage IN (
      'overview', 'footprint', 'entrance', 'interior', 'dungeon', 'battlemap', 'primary'
    )),
  feature_id TEXT,
  anchor TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT '',
  UNIQUE (place_id, map_id, usage)
) STRICT;

INSERT INTO world_place_map_links_v21 (
  id, world_profile_id, place_id, map_id, usage, feature_id, anchor, created_at, updated_at
)
SELECT
  id,
  world_profile_id,
  place_id,
  map_id,
  CASE
    WHEN usage IN (
      'overview', 'footprint', 'entrance', 'interior', 'dungeon', 'battlemap', 'primary'
    ) THEN usage
    WHEN usage = 'detail' THEN 'overview'
    ELSE 'overview'
  END,
  NULL,
  '{}',
  created_at,
  created_at
FROM world_place_map_links;

DROP TABLE world_place_map_links;
ALTER TABLE world_place_map_links_v21 RENAME TO world_place_map_links;

CREATE INDEX IF NOT EXISTS world_place_map_links_world_idx
  ON world_place_map_links (world_profile_id, usage);

CREATE INDEX IF NOT EXISTS world_place_map_links_place_idx
  ON world_place_map_links (place_id);

CREATE INDEX IF NOT EXISTS world_place_map_links_map_idx
  ON world_place_map_links (map_id);

CREATE UNIQUE INDEX IF NOT EXISTS world_place_map_links_primary_uidx
  ON world_place_map_links (place_id)
  WHERE usage = 'primary';

PRAGMA foreign_keys = ON;

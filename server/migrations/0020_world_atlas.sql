-- RPC-ATLAS-MAPS (#862): hierarchical atlas maps + minimal place/link rows for party projection.

CREATE TABLE IF NOT EXISTS world_atlas_maps (
  id TEXT NOT NULL PRIMARY KEY,
  world_profile_id TEXT NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  parent_map_id TEXT REFERENCES world_atlas_maps (id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'world',
  title TEXT NOT NULL DEFAULT 'Weltkarte',
  sort_order INTEGER NOT NULL DEFAULT 0,
  bounds TEXT NOT NULL DEFAULT '{"minX":0,"minY":0,"maxX":1000,"maxY":1000}',
  layers TEXT NOT NULL DEFAULT '{"type":"FeatureCollection","features":[]}',
  basemap_storage_path TEXT,
  azgaar_map_storage_path TEXT,
  generator_meta TEXT NOT NULL DEFAULT '{}',
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (parent_map_id IS NULL OR parent_map_id <> id)
) STRICT;

CREATE INDEX IF NOT EXISTS world_atlas_maps_world_idx
  ON world_atlas_maps (world_profile_id, sort_order, title);

CREATE INDEX IF NOT EXISTS world_atlas_maps_parent_idx
  ON world_atlas_maps (parent_map_id);

CREATE TABLE IF NOT EXISTS world_places (
  id TEXT NOT NULL PRIMARY KEY,
  world_profile_id TEXT NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'site',
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'canonical' CHECK (status IN ('draft', 'canonical', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS world_places_world_idx
  ON world_places (world_profile_id, status);

CREATE TABLE IF NOT EXISTS world_place_map_links (
  id TEXT NOT NULL PRIMARY KEY,
  world_profile_id TEXT NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  place_id TEXT NOT NULL REFERENCES world_places (id) ON DELETE CASCADE,
  map_id TEXT NOT NULL REFERENCES world_atlas_maps (id) ON DELETE CASCADE,
  usage TEXT NOT NULL DEFAULT 'primary' CHECK (usage IN ('primary', 'overview', 'detail')),
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS world_place_map_links_world_idx
  ON world_place_map_links (world_profile_id, usage);

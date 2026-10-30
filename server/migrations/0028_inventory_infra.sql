-- MIG-303 inventory host infra (#802). Module ownership: inventory.
-- Character inventory_v2 payload + durable item definition catalog rows.

ALTER TABLE characters ADD COLUMN inventory_schema_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN inventory_json TEXT NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS inventory_item_definitions (
  id TEXT NOT NULL PRIMARY KEY,
  public_id TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('standard', 'personal', 'world')),
  owner_user_id TEXT,
  world_profile_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  name TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_item_definitions_public_id_uidx
  ON inventory_item_definitions (public_id);
CREATE INDEX IF NOT EXISTS inventory_item_definitions_origin_status_idx
  ON inventory_item_definitions (origin, status);
CREATE INDEX IF NOT EXISTS inventory_item_definitions_owner_idx
  ON inventory_item_definitions (owner_user_id);

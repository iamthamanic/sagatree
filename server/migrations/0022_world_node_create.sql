-- RPC-WORLD-CREATE (#864): idempotency ledger for create_world_node_with_maps.
-- Places/maps/links already expanded in 0021; this adds the create-cache table only.

CREATE TABLE IF NOT EXISTS world_node_create_idempotency (
  world_profile_id TEXT NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (world_profile_id, idempotency_key)
) STRICT;

CREATE INDEX IF NOT EXISTS world_node_create_idempotency_world_idx
  ON world_node_create_idempotency (world_profile_id);

-- MIG-307 (#806): align npc_creature_definitions with Supabase persistence columns.
-- Adds public_id (NPCC-XXXXX) + payload_version. App allocates public_id on write.

ALTER TABLE npc_creature_definitions ADD COLUMN public_id TEXT;
ALTER TABLE npc_creature_definitions ADD COLUMN payload_version INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS npc_creature_definitions_public_id_uidx
  ON npc_creature_definitions (public_id)
  WHERE public_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS npc_creature_definitions_owner_status_idx
  ON npc_creature_definitions (owner_user_id, status)
  WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS npc_creature_definitions_world_status_idx
  ON npc_creature_definitions (world_profile_id, status)
  WHERE world_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS npc_creature_definitions_updated_idx
  ON npc_creature_definitions (updated_at DESC);

-- MIG-307 (#806): align npc_creature_definitions with Supabase persistence columns.
-- Adds public_id (NPCC-XXXXX) + payload_version. Backfills existing rows before unique index.

ALTER TABLE npc_creature_definitions ADD COLUMN public_id TEXT;
ALTER TABLE npc_creature_definitions ADD COLUMN payload_version INTEGER NOT NULL DEFAULT 1;

-- Backfill unique NPCC public ids for any pre-existing rows (alphabet excludes O/0/I/1).
-- SQLite has no crypto RNG; use hex entropy + force letter+digit via fixed prefix mix.
UPDATE npc_creature_definitions
SET public_id = printf(
  'NPCC-%s%s%s',
  'A',
  substr('23456789', 1 + (abs(random()) % 8), 1),
  upper(substr(replace(replace(hex(randomblob(8)), '0', 'A'), '1', 'B'), 1, 3))
)
WHERE public_id IS NULL OR trim(public_id) = '';

-- Second pass: ensure uniqueness if rare collision (re-roll remaining null/dupes).
UPDATE npc_creature_definitions
SET public_id = printf(
  'NPCC-%s%s%s',
  'B',
  substr('23456789', 1 + (abs(random()) % 8), 1),
  upper(substr(replace(replace(hex(randomblob(8)), '0', 'C'), '1', 'D'), 1, 3))
)
WHERE id IN (
  SELECT id FROM npc_creature_definitions
  WHERE public_id IS NULL
     OR public_id IN (
       SELECT public_id FROM npc_creature_definitions
       WHERE public_id IS NOT NULL
       GROUP BY public_id HAVING COUNT(*) > 1
     )
);

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

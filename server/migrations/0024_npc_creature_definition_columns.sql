-- MIG-307 (#806): align npc_creature_definitions with Supabase persistence columns.
-- Adds public_id (NPCC-XXXXX) + payload_version.
-- Deterministic backfill guarantees letter+digit body before unique index.

ALTER TABLE npc_creature_definitions ADD COLUMN public_id TEXT;
ALTER TABLE npc_creature_definitions ADD COLUMN payload_version INTEGER NOT NULL DEFAULT 1;

-- Position 1 always letter, position 5 always digit → Letter+Digit contract.
UPDATE npc_creature_definitions
SET public_id = 'NPCC-' ||
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + (unicode(substr(id, 1, 1)) % 24), 1) ||
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (unicode(substr(id || 'x', 2, 1)) % 32), 1) ||
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (unicode(substr(id || 'y', 3, 1)) % 32), 1) ||
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (unicode(substr(id || 'z', 4, 1)) % 32), 1) ||
  substr('23456789', 1 + (
    (length(id) + unicode(substr(id, -1, 1)) + unicode(substr(id, max(1, length(id) / 2), 1))) % 8
  ), 1)
WHERE public_id IS NULL OR trim(public_id) = '';

-- Resolve residual duplicates via rowid; keep letter + digit guarantee.
UPDATE npc_creature_definitions
SET public_id = 'NPCC-' ||
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + ((rowid) % 24), 1) ||
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + ((rowid / 32) % 32), 1) ||
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + ((rowid / 1024) % 32), 1) ||
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + ((rowid / 32768) % 32), 1) ||
  substr('23456789', 1 + ((rowid / 1048576) % 8), 1)
WHERE id IN (
  SELECT id FROM npc_creature_definitions
  WHERE public_id IN (
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

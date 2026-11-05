-- CUT-10 / #1145: worlds.public_id (WO-XXXXX) for authorized public-id lookup.
-- Module ownership: world. Permission remains owner/membership — public_id is not authority.

ALTER TABLE worlds ADD COLUMN public_id TEXT;

-- Collision-free backfill over alphabet without O/0/I/1; digit forced at index 2.
UPDATE worlds
SET public_id = printf(
  'WO-%s2%s%s%s',
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (rowid / 32768) % 32 + 1, 1),
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (rowid / 1024) % 32 + 1, 1),
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (rowid / 32) % 32 + 1, 1),
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', rowid % 32 + 1, 1)
)
WHERE public_id IS NULL OR TRIM(public_id) = '';

CREATE UNIQUE INDEX IF NOT EXISTS worlds_public_id_uidx
  ON worlds (public_id)
  WHERE public_id IS NOT NULL AND TRIM(public_id) <> '';

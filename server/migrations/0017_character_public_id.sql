-- RPC-SESSION-ACCESS (#869): characters.public_id for invite resolve parity.
ALTER TABLE characters ADD COLUMN public_id TEXT;

-- Collision-free backfill over alphabet without O/0/I/1; digit forced at index 2.
UPDATE characters
SET public_id = printf(
  'CH-%s2%s%s%s',
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (rowid / 32768) % 32 + 1, 1),
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (rowid / 1024) % 32 + 1, 1),
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (rowid / 32) % 32 + 1, 1),
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', rowid % 32 + 1, 1)
)
WHERE public_id IS NULL OR TRIM(public_id) = '';

CREATE UNIQUE INDEX IF NOT EXISTS characters_public_id_uidx
  ON characters (public_id)
  WHERE public_id IS NOT NULL AND TRIM(public_id) <> '';

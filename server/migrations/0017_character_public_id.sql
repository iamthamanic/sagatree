-- RPC-SESSION-ACCESS (#869): characters.public_id for invite resolve parity.
ALTER TABLE characters ADD COLUMN public_id TEXT;

-- Backfill with CH- + 5 chars from alphabet without O/0/I/1 (must include letter+digit).
-- Deterministic per row id so upgrades are stable; body guaranteed mixed via fixed suffix pattern.
UPDATE characters
SET public_id = 'CH-' ||
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ', (unicode(id) % 24) + 1, 1) ||
  substr('23456789', (unicode(substr(id, 2, 1)) % 8) + 1, 1) ||
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ', (unicode(substr(id, 3, 1)) % 24) + 1, 1) ||
  substr('23456789', (unicode(substr(id, 4, 1)) % 8) + 1, 1) ||
  substr('ABCDEFGHJKLMNPQRSTUVWXYZ', (unicode(substr(id, 5, 1)) % 24) + 1, 1)
WHERE public_id IS NULL OR TRIM(public_id) = '';

CREATE UNIQUE INDEX IF NOT EXISTS characters_public_id_uidx
  ON characters (public_id)
  WHERE public_id IS NOT NULL AND TRIM(public_id) <> '';

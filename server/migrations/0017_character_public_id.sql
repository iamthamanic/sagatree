-- RPC-SESSION-ACCESS (#869): characters.public_id for invite resolve parity.
ALTER TABLE characters ADD COLUMN public_id TEXT;

-- Backfill existing rows with immutable CH-XXXXX ids (alphabet without O/0/I/1).
UPDATE characters
SET public_id = 'CH-' || upper(substr(hex(randomblob(3)), 1, 5))
WHERE public_id IS NULL OR TRIM(public_id) = '';

CREATE UNIQUE INDEX IF NOT EXISTS characters_public_id_uidx
  ON characters (public_id)
  WHERE public_id IS NOT NULL AND TRIM(public_id) <> '';

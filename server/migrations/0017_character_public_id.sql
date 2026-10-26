-- RPC-SESSION-ACCESS (#869): characters.public_id for invite resolve parity.
ALTER TABLE characters ADD COLUMN public_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS characters_public_id_uidx
  ON characters (public_id)
  WHERE public_id IS NOT NULL AND TRIM(public_id) <> '';

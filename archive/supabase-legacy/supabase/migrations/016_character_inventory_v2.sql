-- Inventory v2 (#109): persist Inventory-v2 state alongside the legacy ItemDto[]
-- column. Legacy `inventory` is never destructively erased; the version marker
-- decides which reader is authoritative.

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS inventory_schema_version INTEGER NOT NULL DEFAULT 1
    CHECK (inventory_schema_version IN (1, 2));

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS inventory_v2 JSONB;

COMMENT ON COLUMN public.characters.inventory_schema_version IS
  '1 = legacy ItemDto[] in inventory is authoritative; 2 = inventory_v2 is authoritative.';

COMMENT ON COLUMN public.characters.inventory_v2 IS
  'Inventory v2 state (schemaVersion, instances, baseSlots, containers, equipment, quickSlots, legacyOverflow). Null until first migration/save.';

CREATE INDEX IF NOT EXISTS idx_characters_inventory_schema_version
  ON public.characters(inventory_schema_version)
  WHERE inventory_schema_version = 2;

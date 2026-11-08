-- Raise character-avatars ceiling to 150 MiB for high-detail GLB/VRM imports + Meshy masters.
-- Aligns domain AVATAR_IMPORT_MAX_BYTES / AVATAR_SAVE_EXPORT_MAX_BYTES / store max (157286400).

UPDATE storage.buckets
SET file_size_limit = 157286400
WHERE id = 'character-avatars';

ALTER TABLE public.character_avatar_import_assets
  DROP CONSTRAINT IF EXISTS character_avatar_import_assets_byte_size_check;

ALTER TABLE public.character_avatar_import_assets
  ADD CONSTRAINT character_avatar_import_assets_byte_size_check
  CHECK (byte_size > 0 AND byte_size <= 157286400);

ALTER TABLE public.character_avatar_export_assets
  DROP CONSTRAINT IF EXISTS character_avatar_export_assets_byte_size_check;

ALTER TABLE public.character_avatar_export_assets
  ADD CONSTRAINT character_avatar_export_assets_byte_size_check
  CHECK (byte_size > 0 AND byte_size <= 157286400);

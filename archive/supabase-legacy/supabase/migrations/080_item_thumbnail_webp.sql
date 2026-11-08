-- Item thumbnail WebP contract (#641): Domain/Edge/Bucket/DB aligned.
-- Existing PNG/JPEG rows remain valid; ACL policies unchanged.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id = 'item-thumbnails';

ALTER TABLE public.item_thumbnail_assets
  DROP CONSTRAINT IF EXISTS item_thumbnail_assets_mime_check;

ALTER TABLE public.item_thumbnail_assets
  ADD CONSTRAINT item_thumbnail_assets_mime_check
  CHECK (mime IN ('image/png', 'image/jpeg', 'image/webp'));

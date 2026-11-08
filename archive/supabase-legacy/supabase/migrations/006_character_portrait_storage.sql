-- Character portrait storage for hosted and self-hosted Supabase.
-- Portraits stay private; authenticated users may only upload/read objects under their own user-id folder.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) VALUES (
  'character-portraits',
  'character-portraits',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can upload own character portraits" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own character portraits" ON storage.objects;

CREATE POLICY "Users can upload own character portraits"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'character-portraits'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own character portraits"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'character-portraits'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

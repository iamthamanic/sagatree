-- Character avatar import assets (#5): private VRM/GLB storage, owner-scoped paths.
-- Capabilities / rig analysis are never written by the browser (#6 owns that).

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) VALUES (
  'character-avatars',
  'character-avatars',
  false,
  41943040,
  ARRAY['model/gltf-binary', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can upload own character avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own character avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own character avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own character avatars" ON storage.objects;

CREATE POLICY "Users can upload own character avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'character-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own character avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'character-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own character avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'character-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'character-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own character avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'character-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE TABLE IF NOT EXISTS public.character_avatar_import_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID,
  format TEXT NOT NULL CHECK (format IN ('vrm', 'glb')),
  mime TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 41943040),
  storage_path TEXT NOT NULL,
  rig_analysis_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (rig_analysis_status IN ('pending', 'static', 'partial', 'ready', 'unsupported', 'failed')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_character_avatar_import_owner
  ON public.character_avatar_import_assets(owner_user_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_character_avatar_import_one_active
  ON public.character_avatar_import_assets(owner_user_id, character_id)
  WHERE is_active = true AND deleted_at IS NULL AND character_id IS NOT NULL;

ALTER TABLE public.character_avatar_import_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own avatar imports" ON public.character_avatar_import_assets;
DROP POLICY IF EXISTS "Owners insert own avatar imports" ON public.character_avatar_import_assets;
DROP POLICY IF EXISTS "Owners update own avatar imports" ON public.character_avatar_import_assets;

CREATE POLICY "Owners read own avatar imports"
  ON public.character_avatar_import_assets FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY "Owners insert own avatar imports"
  ON public.character_avatar_import_assets FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid() AND rig_analysis_status = 'pending');

CREATE POLICY "Owners update own avatar imports"
  ON public.character_avatar_import_assets FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

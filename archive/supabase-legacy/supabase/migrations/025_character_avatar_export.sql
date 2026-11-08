-- Character avatar save-export assets (#7): owner-scoped materialized GLB on Character Save.
-- Compact appearance.avatar remains SoT; this table tracks exactly-one active export artifact.

CREATE TABLE IF NOT EXISTS public.character_avatar_export_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID,
  format TEXT NOT NULL CHECK (format IN ('glb')),
  mime TEXT NOT NULL DEFAULT 'model/gltf-binary',
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 41943040),
  storage_path TEXT NOT NULL,
  export_contract_version TEXT NOT NULL DEFAULT 'AvatarSaveExportV1',
  morph_contract_version TEXT NOT NULL DEFAULT 'SagaDriveAvatarMorphV1',
  embeds_source_mesh BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_character_avatar_export_owner
  ON public.character_avatar_export_assets(owner_user_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_character_avatar_export_one_active
  ON public.character_avatar_export_assets(owner_user_id, character_id)
  WHERE is_active = true AND deleted_at IS NULL AND character_id IS NOT NULL;

ALTER TABLE public.character_avatar_export_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own avatar exports" ON public.character_avatar_export_assets;
DROP POLICY IF EXISTS "Owners insert own avatar exports" ON public.character_avatar_export_assets;
DROP POLICY IF EXISTS "Owners update own avatar exports" ON public.character_avatar_export_assets;

CREATE POLICY "Owners read own avatar exports"
  ON public.character_avatar_export_assets FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY "Owners insert own avatar exports"
  ON public.character_avatar_export_assets FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND format = 'glb'
    AND export_contract_version = 'AvatarSaveExportV1'
  );

CREATE POLICY "Owners update own avatar exports"
  ON public.character_avatar_export_assets FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

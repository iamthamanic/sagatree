-- ===========================================
-- World Profiles
-- First-class library entities for setting/module configuration.
-- Deliberately separate from project-scoped world_graphs and the legacy world edge function.
-- ===========================================

CREATE TABLE IF NOT EXISTS public.world_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL CHECK (char_length(btrim(name)) > 0),
  description TEXT,
  modules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(modules) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_world_profiles_owner_created
  ON public.world_profiles(owner_user_id, created_at DESC);

ALTER TABLE public.world_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their world profiles" ON public.world_profiles
  FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "Users can insert their world profiles" ON public.world_profiles
  FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users can update their world profiles" ON public.world_profiles
  FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users can delete their world profiles" ON public.world_profiles
  FOR DELETE
  USING (owner_user_id = auth.uid());

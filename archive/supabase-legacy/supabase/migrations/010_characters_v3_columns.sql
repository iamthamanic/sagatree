-- 010_characters_v3_columns.sql
-- Idempotent schema-levelling migration: brings a stack created from 001-009
-- up to the V3 characters shape the app DTO expects (src/supabase/schema_v3_complete.sql).
-- Non-destructive: ADD COLUMN IF NOT EXISTS only, no drops, no data rewrites.
-- Background: the app CharacterDto (character_type, appearance, hp fields, marketplace
-- fields, world_id) predates this local database, which was seeded only via
-- 001-009 where those columns never existed.

-- 1. Worlds table (referenced by characters.world_id in V3; missing entirely here)
CREATE TABLE IF NOT EXISTS public.worlds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ruleset_id UUID REFERENCES public.rulesets(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  lore TEXT,
  setting_type TEXT,
  tags TEXT[] DEFAULT '{}',
  cover_image_url TEXT,
  is_public BOOLEAN DEFAULT false,
  is_marketplace_item BOOLEAN DEFAULT false,
  downloads_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2),
  price INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.worlds ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worlds' AND policyname = 'Worlds are visible to everyone') THEN
    CREATE POLICY "Worlds are visible to everyone" ON public.worlds FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worlds' AND policyname = 'Users can create worlds') THEN
    CREATE POLICY "Users can create worlds" ON public.worlds FOR INSERT TO authenticated WITH CHECK (creator_user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worlds' AND policyname = 'Users can update their worlds') THEN
    CREATE POLICY "Users can update their worlds" ON public.worlds FOR UPDATE TO authenticated USING (creator_user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worlds' AND policyname = 'Users can delete their worlds') THEN
    CREATE POLICY "Users can delete their worlds" ON public.worlds FOR DELETE TO authenticated USING (creator_user_id = auth.uid());
  END IF;
END $$;

-- 2. Characters: add every V3 column the DTO/services reference (idempotent)
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS world_id UUID REFERENCES public.worlds(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS character_type TEXT,
  ADD COLUMN IF NOT EXISTS ruleset_id UUID REFERENCES public.rulesets(id),
  ADD COLUMN IF NOT EXISTS background_story TEXT,
  ADD COLUMN IF NOT EXISTS appearance JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS token_url TEXT,
  ADD COLUMN IF NOT EXISTS derived_stats JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS proficiencies TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hp_current INTEGER,
  ADD COLUMN IF NOT EXISTS hp_max INTEGER,
  ADD COLUMN IF NOT EXISTS armor_class INTEGER,
  ADD COLUMN IF NOT EXISTS initiative_bonus INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS speed INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS resources JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS conditions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_marketplace_item BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS downloads_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2);

-- Enforce the V3 type constraint; DEFAULT 'pc' keeps legacy rows insertable
-- without an explicit type (app services always set it explicitly).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'characters_character_type_check') THEN
    ALTER TABLE public.characters
      ALTER COLUMN character_type SET DEFAULT 'pc',
      ALTER COLUMN character_type SET NOT NULL,
      ADD CONSTRAINT characters_character_type_check
        CHECK (character_type IN ('pc', 'npc', 'companion', 'monster'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_characters_owner ON public.characters(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_characters_project ON public.characters(project_id);
CREATE INDEX IF NOT EXISTS idx_characters_world ON public.characters(world_id);
CREATE INDEX IF NOT EXISTS idx_worlds_creator ON public.worlds(creator_user_id);
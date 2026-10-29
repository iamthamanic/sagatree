-- SagaTree Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Characters Table
CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  class TEXT NOT NULL,
  race TEXT NOT NULL,
  level INTEGER DEFAULT 1,
  appearance JSONB DEFAULT '{}'::jsonb,
  attributes JSONB DEFAULT '{}'::jsonb,
  abilities JSONB DEFAULT '[]'::jsonb,
  inventory JSONB DEFAULT '[]'::jsonb,
  emotion_profiles JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  adventure_id UUID,
  gm_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'paused', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Session Players Table (many-to-many)
CREATE TABLE IF NOT EXISTS session_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  is_online BOOLEAN DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- Adventures Table
CREATE TABLE IF NOT EXISTS adventures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  genre TEXT NOT NULL,
  world_template TEXT,
  ruleset TEXT,
  scenes JSONB DEFAULT '[]'::jsonb,
  npcs JSONB DEFAULT '[]'::jsonb,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Marketplace Items Table
CREATE TABLE IF NOT EXISTS marketplace_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('world', 'adventure', 'character', 'item', 'ruleset')),
  title TEXT NOT NULL,
  description TEXT,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  rating DECIMAL(2,1) DEFAULT 0.0,
  downloads INTEGER DEFAULT 0,
  price DECIMAL(10,2) DEFAULT 0.00,
  image_url TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE marketplace_items ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE marketplace_items ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

-- Row Level Security (RLS) Policies

-- Characters: Users can only access their own characters
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own characters"
  ON characters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own characters"
  ON characters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own characters"
  ON characters FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own characters"
  ON characters FOR DELETE
  USING (auth.uid() = user_id);

-- Sessions: Only GM can see/manage their sessions
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sessions where they are GM"
  ON sessions FOR SELECT
  USING (auth.uid() = gm_user_id);

CREATE POLICY "Users can create sessions as GM"
  ON sessions FOR INSERT
  WITH CHECK (auth.uid() = gm_user_id);

CREATE POLICY "GM can update their sessions"
  ON sessions FOR UPDATE
  USING (auth.uid() = gm_user_id);

CREATE POLICY "GM can delete their sessions"
  ON sessions FOR DELETE
  USING (auth.uid() = gm_user_id);

-- Session Players
ALTER TABLE session_players ENABLE ROW LEVEL SECURITY;

-- Users can see their own player records
CREATE POLICY "Users can view their own session player records"
  ON session_players FOR SELECT
  USING (auth.uid() = user_id);

-- GM can see all players in their sessions (no circular dependency)
CREATE POLICY "GM can view players in their sessions"
  ON session_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_players.session_id
      AND sessions.gm_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join sessions"
  ON session_players FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their session player record"
  ON session_players FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can leave sessions"
  ON session_players FOR DELETE
  USING (auth.uid() = user_id);

-- GM can remove players from their sessions
CREATE POLICY "GM can remove players from their sessions"
  ON session_players FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_players.session_id
      AND sessions.gm_user_id = auth.uid()
    )
  );

-- Adventures
ALTER TABLE adventures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own or public adventures"
  ON adventures FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can create adventures"
  ON adventures FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own adventures"
  ON adventures FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own adventures"
  ON adventures FOR DELETE
  USING (auth.uid() = user_id);

-- Marketplace Items
ALTER TABLE marketplace_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view marketplace items"
  ON marketplace_items FOR SELECT
  USING (true);

CREATE POLICY "Users can create marketplace items"
  ON marketplace_items FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their items"
  ON marketplace_items FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete their items"
  ON marketplace_items FOR DELETE
  USING (auth.uid() = author_id);

-- Indexes for performance
CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_sessions_gm_user_id ON sessions(gm_user_id);
CREATE INDEX idx_sessions_code ON sessions(code);
CREATE INDEX idx_session_players_session_id ON session_players(session_id);
CREATE INDEX idx_session_players_user_id ON session_players(user_id);
CREATE INDEX idx_adventures_user_id ON adventures(user_id);
CREATE INDEX idx_adventures_is_public ON adventures(is_public);
CREATE INDEX idx_marketplace_items_type ON marketplace_items(type);
CREATE INDEX idx_marketplace_items_author_id ON marketplace_items(author_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON characters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_adventures_updated_at BEFORE UPDATE ON adventures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_items_updated_at BEFORE UPDATE ON marketplace_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Client-trust (#675): privileged columns are server-authority only
CREATE OR REPLACE FUNCTION public.marketplace_items_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;
    NEW.author_id := auth.uid();
    NEW.rating := 0;
    NEW.downloads := 0;
    NEW.is_featured := false;
    NEW.created_at := now();
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.author_id := OLD.author_id;
    NEW.rating := OLD.rating;
    NEW.downloads := OLD.downloads;
    NEW.is_featured := OLD.is_featured;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_items_guard_privileged_columns ON public.marketplace_items;
CREATE TRIGGER marketplace_items_guard_privileged_columns
  BEFORE INSERT OR UPDATE ON public.marketplace_items
  FOR EACH ROW
  EXECUTE FUNCTION public.marketplace_items_guard_privileged_columns();

REVOKE ALL ON TABLE public.marketplace_items FROM PUBLIC;
REVOKE INSERT, UPDATE ON TABLE public.marketplace_items FROM anon;
REVOKE INSERT, UPDATE ON TABLE public.marketplace_items FROM authenticated;
GRANT SELECT ON TABLE public.marketplace_items TO anon, authenticated;
GRANT INSERT (
  type,
  title,
  description,
  data,
  price,
  image_url,
  tags
) ON TABLE public.marketplace_items TO authenticated;
GRANT UPDATE (
  type,
  title,
  description,
  data,
  price,
  image_url,
  tags,
  updated_at
) ON TABLE public.marketplace_items TO authenticated;
GRANT DELETE ON TABLE public.marketplace_items TO authenticated;

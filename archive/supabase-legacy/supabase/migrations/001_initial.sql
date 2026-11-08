-- ===========================================
-- SagaDrive Database Schema
-- ===========================================

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";

-- ===========================================
-- AUTH SCHEMA (Managed by GoTrue)
-- ===========================================

-- Users are in auth.users (managed by Supabase Auth)

-- ===========================================
-- PUBLIC SCHEMA
-- ===========================================

-- Projects (Campaigns)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(8) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  world_id UUID,
  gm_user_id UUID REFERENCES auth.users(id) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Members
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  character_id UUID,
  role VARCHAR(20) DEFAULT 'player' CHECK (role IN ('gm', 'player', 'observer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'kicked')),
  UNIQUE(project_id, user_id)
);

-- Characters
CREATE TABLE IF NOT EXISTS public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES auth.users(id) NOT NULL,
  project_id UUID REFERENCES public.projects(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  class VARCHAR(100),
  race VARCHAR(100),
  level INT DEFAULT 1,
  attributes JSONB DEFAULT '{}',
  skills JSONB DEFAULT '{}',
  inventory JSONB DEFAULT '[]',
  portrait_url TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  session_number INT NOT NULL,
  name VARCHAR(255),
  description TEXT,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'paused', 'completed')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  notes TEXT,
  world_state JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session Players (Online Status)
CREATE TABLE IF NOT EXISTS public.session_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  character_id UUID REFERENCES public.characters(id),
  is_online BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  UNIQUE(session_id, user_id)
);

-- NPC Memories (for Lorekeeper sync)
CREATE TABLE IF NOT EXISTS public.npc_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  npc_name VARCHAR(255) NOT NULL,
  npc_id VARCHAR(255),
  memory_type VARCHAR(50) CHECK (memory_type IN ('event', 'relationship', 'location', 'item', 'conversation')),
  content JSONB NOT NULL,
  importance INT DEFAULT 1 CHECK (importance BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Combat States (for DM Tools sync)
CREATE TABLE IF NOT EXISTS public.combat_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  round INT DEFAULT 1,
  current_turn INT DEFAULT 0,
  initiative_order JSONB NOT NULL DEFAULT '[]',
  combat_log JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'paused', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id)
);

-- World Graphs (Reference to Neo4j)
CREATE TABLE IF NOT EXISTS public.world_graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  neo4j_graph_id VARCHAR(255) UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rulesets
CREATE TABLE IF NOT EXISTS public.rulesets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50),
  description TEXT,
  rules JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Messages (for Realtime)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  character_id UUID REFERENCES public.characters(id),
  message TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'player' CHECK (type IN ('player', 'dm', 'system', 'npc')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_projects_gm ON public.projects(gm_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_code ON public.projects(code);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_characters_owner ON public.characters(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_characters_project ON public.characters(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON public.sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);
CREATE INDEX IF NOT EXISTS idx_session_players_session ON public.session_players(session_id);
CREATE INDEX IF NOT EXISTS idx_npc_memories_session ON public.npc_memories(session_id);
CREATE INDEX IF NOT EXISTS idx_npc_memories_npc ON public.npc_memories(npc_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.chat_messages(session_id);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

-- Projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects" ON public.projects
  FOR SELECT USING (
    gm_user_id = auth.uid() 
    OR id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "GMs can insert their projects" ON public.projects
  FOR INSERT WITH CHECK (gm_user_id = auth.uid());

CREATE POLICY "GMs can update their projects" ON public.projects
  FOR UPDATE USING (gm_user_id = auth.uid());

CREATE POLICY "GMs can delete their projects" ON public.projects
  FOR DELETE USING (gm_user_id = auth.uid());

-- Project Members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project members" ON public.project_members
  FOR SELECT USING (
    project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "GMs can manage project members" ON public.project_members
  FOR ALL USING (
    project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid())
  );

-- Characters
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their characters" ON public.characters
  FOR SELECT USING (
    owner_user_id = auth.uid()
    OR is_public = true
    OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert their characters" ON public.characters
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users can update their characters" ON public.characters
  FOR UPDATE USING (owner_user_id = auth.uid());

CREATE POLICY "Users can delete their characters" ON public.characters
  FOR DELETE USING (owner_user_id = auth.uid());

-- Sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their sessions" ON public.sessions
  FOR SELECT USING (
    project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid())
    OR project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "GMs can manage sessions" ON public.sessions
  FOR ALL USING (
    project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid())
  );

-- Session Players
ALTER TABLE public.session_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view session players" ON public.session_players
  FOR SELECT USING (
    session_id IN (SELECT id FROM public.sessions WHERE project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid()))
    OR user_id = auth.uid()
  );

CREATE POLICY "GMs can manage session players" ON public.session_players
  FOR ALL USING (
    session_id IN (SELECT id FROM public.sessions WHERE project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid()))
  );

-- NPC Memories
ALTER TABLE public.npc_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view NPC memories" ON public.npc_memories
  FOR SELECT USING (
    session_id IN (SELECT id FROM public.sessions WHERE project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid()))
    OR session_id IN (SELECT id FROM public.sessions WHERE project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()))
  );

CREATE POLICY "GMs can manage NPC memories" ON public.npc_memories
  FOR ALL USING (
    session_id IN (SELECT id FROM public.sessions WHERE project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid()))
  );

-- Combat States
ALTER TABLE public.combat_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view combat states" ON public.combat_states
  FOR SELECT USING (
    session_id IN (SELECT id FROM public.sessions WHERE project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid()))
    OR session_id IN (SELECT id FROM public.sessions WHERE project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()))
  );

CREATE POLICY "GMs can manage combat states" ON public.combat_states
  FOR ALL USING (
    session_id IN (SELECT id FROM public.sessions WHERE project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid()))
  );

-- Chat Messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chat messages" ON public.chat_messages
  FOR SELECT USING (
    session_id IN (SELECT id FROM public.sessions WHERE project_id IN (SELECT id FROM public.projects WHERE gm_user_id = auth.uid()))
    OR session_id IN (SELECT id FROM public.sessions WHERE project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()))
  );

CREATE POLICY "Users can insert chat messages" ON public.chat_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    session_id IN (SELECT id FROM public.sessions WHERE project_id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid()))
  );

-- ===========================================
-- FUNCTIONS AND TRIGGERS
-- ===========================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_combat_states_updated_at BEFORE UPDATE ON public.combat_states
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Generate project code on insert
CREATE OR REPLACE FUNCTION generate_project_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_project_code_trigger BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION generate_project_code();

-- ===========================================
-- REALTIME PUBLICATION
-- ===========================================

-- Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.combat_states;
ALTER PUBLICATION supabase_realtime ADD TABLE public.npc_memories;
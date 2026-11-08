-- SagaTree Database Schema V2
-- Updated terminology: Projects (campaigns) contain Sessions (individual play sessions)

-- ============================================
-- CHARACTERS
-- ============================================

CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  class TEXT,
  race TEXT,
  level INTEGER DEFAULT 1,
  appearance JSONB DEFAULT '{}'::jsonb,
  attributes JSONB DEFAULT '{}'::jsonb,
  abilities JSONB[] DEFAULT ARRAY[]::jsonb[],
  inventory JSONB[] DEFAULT ARRAY[]::jsonb[],
  emotion_profiles JSONB[] DEFAULT ARRAY[]::jsonb[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Characters RLS
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own characters"
  ON characters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own characters"
  ON characters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own characters"
  ON characters FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own characters"
  ON characters FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- PROJECTS (formerly "sessions")
-- A project is a campaign/adventure with a GM and players
-- ============================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- 6-digit join code
  name TEXT NOT NULL,
  description TEXT,
  world_id UUID, -- Optional: link to a world (future feature)
  gm_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Projects RLS: Only GM can see/manage their projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects where they are GM"
  ON projects FOR SELECT
  USING (auth.uid() = gm_user_id);

CREATE POLICY "Users can create projects as GM"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = gm_user_id);

CREATE POLICY "GM can update their projects"
  ON projects FOR UPDATE
  USING (auth.uid() = gm_user_id);

CREATE POLICY "GM can delete their projects"
  ON projects FOR DELETE
  USING (auth.uid() = gm_user_id);

-- ============================================
-- PROJECT MEMBERS (formerly "session_players")
-- Players who are part of a project
-- ============================================

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'player' CHECK (role IN ('gm', 'player')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'kicked')),
  UNIQUE(project_id, user_id)
);

-- Project Members RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Users can see their own member records
CREATE POLICY "Users can view their own project member records"
  ON project_members FOR SELECT
  USING (auth.uid() = user_id);

-- GM can see all members in their projects
CREATE POLICY "GM can view members in their projects"
  ON project_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
      AND projects.gm_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join projects"
  ON project_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their member record"
  ON project_members FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can leave projects"
  ON project_members FOR DELETE
  USING (auth.uid() = user_id);

-- GM can remove members from their projects
CREATE POLICY "GM can remove members from their projects"
  ON project_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
      AND projects.gm_user_id = auth.uid()
    )
  );

-- ============================================
-- SESSIONS
-- Individual play sessions within a project
-- ============================================

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL, -- Session 1, 2, 3, etc.
  name TEXT, -- Optional: "The Battle of Helm's Deep"
  notes TEXT, -- GM notes for this session
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER, -- Calculated duration
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, session_number)
);

-- Sessions RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- GM can view sessions in their projects
CREATE POLICY "GM can view sessions in their projects"
  ON sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = sessions.project_id
      AND projects.gm_user_id = auth.uid()
    )
  );

-- Players can view sessions in projects they're members of
CREATE POLICY "Players can view sessions in their projects"
  ON sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = sessions.project_id
      AND project_members.user_id = auth.uid()
      AND project_members.status = 'active'
    )
  );

CREATE POLICY "GM can create sessions"
  ON sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = sessions.project_id
      AND projects.gm_user_id = auth.uid()
    )
  );

CREATE POLICY "GM can update sessions"
  ON sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = sessions.project_id
      AND projects.gm_user_id = auth.uid()
    )
  );

CREATE POLICY "GM can delete sessions"
  ON sessions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = sessions.project_id
      AND projects.gm_user_id = auth.uid()
    )
  );

-- ============================================
-- SESSION PARTICIPANTS
-- Track which players attended each session
-- ============================================

CREATE TABLE IF NOT EXISTS session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  left_at TIMESTAMPTZ,
  was_present BOOLEAN DEFAULT true,
  UNIQUE(session_id, user_id)
);

-- Session Participants RLS
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view session participants"
  ON session_participants FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM sessions
      JOIN projects ON projects.id = sessions.project_id
      WHERE sessions.id = session_participants.session_id
      AND projects.gm_user_id = auth.uid()
    )
  );

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_projects_gm_user_id ON projects(gm_user_id);
CREATE INDEX idx_projects_code ON projects(code);
CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
CREATE INDEX idx_sessions_project_id ON sessions(project_id);
CREATE INDEX idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX idx_session_participants_user_id ON session_participants(user_id);

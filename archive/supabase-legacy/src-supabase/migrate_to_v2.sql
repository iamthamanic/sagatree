-- Migration Script: Rename sessions → projects
-- Run this to migrate existing data

-- Step 1: Rename tables
ALTER TABLE IF EXISTS sessions RENAME TO projects;
ALTER TABLE IF EXISTS session_players RENAME TO project_members;

-- Step 2: Add new columns to projects (if not exist)
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS world_id UUID;

-- Step 3: Update status values
UPDATE projects 
SET status = 'active' 
WHERE status = 'waiting';

-- Step 4: Update project_members columns
ALTER TABLE project_members 
  RENAME COLUMN session_id TO project_id;

ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'player' CHECK (role IN ('gm', 'player')),
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'kicked'));

-- Step 5: Remove old columns
ALTER TABLE project_members 
  DROP COLUMN IF EXISTS is_online;

-- Step 6: Create new sessions table (for individual play sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  name TEXT,
  notes TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, session_number)
);

-- Step 7: Create session_participants table
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

-- Step 8: Create indexes
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user_id ON session_participants(user_id);

-- Step 9: Update RLS policies
-- (Copy the policies from schema_v2.sql)

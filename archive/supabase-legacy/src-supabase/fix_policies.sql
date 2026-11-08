-- Fix RLS Policies - Private Sessions System
-- Each session is only visible to GM and invited players

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view sessions they're involved in" ON sessions;
DROP POLICY IF EXISTS "Users can view all sessions" ON sessions;
DROP POLICY IF EXISTS "Users can view session players" ON session_players;
DROP POLICY IF EXISTS "Users can view all session players" ON session_players;
DROP POLICY IF EXISTS "Users can update their session player record" ON session_players;

-- SESSIONS POLICIES
-- Users can only see sessions where they are the GM
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

-- SESSION_PLAYERS POLICIES
-- Users can only see player records where they are the player
CREATE POLICY "Users can view their own session player records"
  ON session_players FOR SELECT
  USING (auth.uid() = user_id);

-- GM can see all players in their sessions
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

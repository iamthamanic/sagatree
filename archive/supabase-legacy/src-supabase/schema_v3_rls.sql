-- ============================================
-- RLS POLICIES for Schema V3
-- ============================================

-- ============================================
-- 1. RULESETS
-- ============================================

ALTER TABLE rulesets ENABLE ROW LEVEL SECURITY;

-- Everyone can view official & public rulesets
CREATE POLICY "Users can view official and public rulesets"
  ON rulesets FOR SELECT
  USING (is_official = true OR is_public = true OR creator_user_id = auth.uid());

-- Users can create their own rulesets
CREATE POLICY "Users can create rulesets"
  ON rulesets FOR INSERT
  WITH CHECK (creator_user_id = auth.uid());

-- Users can update their own rulesets
CREATE POLICY "Users can update their own rulesets"
  ON rulesets FOR UPDATE
  USING (creator_user_id = auth.uid());

-- Users can delete their own rulesets
CREATE POLICY "Users can delete their own rulesets"
  ON rulesets FOR DELETE
  USING (creator_user_id = auth.uid());

-- ============================================
-- 2. WORLDS
-- ============================================

ALTER TABLE worlds ENABLE ROW LEVEL SECURITY;

-- Users can view public worlds and their own worlds
CREATE POLICY "Users can view public and own worlds"
  ON worlds FOR SELECT
  USING (is_public = true OR creator_user_id = auth.uid());

CREATE POLICY "Users can create worlds"
  ON worlds FOR INSERT
  WITH CHECK (creator_user_id = auth.uid());

CREATE POLICY "Users can update their own worlds"
  ON worlds FOR UPDATE
  USING (creator_user_id = auth.uid());

CREATE POLICY "Users can delete their own worlds"
  ON worlds FOR DELETE
  USING (creator_user_id = auth.uid());

-- ============================================
-- 3. LOCATIONS
-- ============================================

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Users can view locations in worlds they can see
CREATE POLICY "Users can view locations in accessible worlds"
  ON locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM worlds
      WHERE worlds.id = locations.world_id
      AND (worlds.is_public = true OR worlds.creator_user_id = auth.uid())
    )
  );

-- Users can create locations in their own worlds
CREATE POLICY "Users can create locations in own worlds"
  ON locations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM worlds
      WHERE worlds.id = locations.world_id
      AND worlds.creator_user_id = auth.uid()
    )
  );

-- Similar for UPDATE and DELETE
CREATE POLICY "Users can update locations in own worlds"
  ON locations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM worlds
      WHERE worlds.id = locations.world_id
      AND worlds.creator_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete locations in own worlds"
  ON locations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM worlds
      WHERE worlds.id = locations.world_id
      AND worlds.creator_user_id = auth.uid()
    )
  );

-- ============================================
-- 4. CHARACTERS
-- ============================================

ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

-- Users can view:
-- - Their own PCs
-- - NPCs in public worlds
-- - NPCs in their worlds
-- - NPCs/Monsters in marketplace
-- - Characters in projects where they are active members
CREATE POLICY "Users can view accessible characters"
  ON characters FOR SELECT
  USING (
    -- Own PCs
    (character_type = 'pc' AND owner_user_id = auth.uid())
    OR
    -- NPCs in public worlds
    (world_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM worlds WHERE worlds.id = characters.world_id AND worlds.is_public = true
    ))
    OR
    -- NPCs in own worlds
    (world_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM worlds WHERE worlds.id = characters.world_id AND worlds.creator_user_id = auth.uid()
    ))
    OR
    -- Marketplace items
    is_marketplace_item = true
    OR
    -- Characters in projects user is actively a member of
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = characters.project_id
      AND project_members.user_id = auth.uid()
      AND project_members.status = 'active'
    ))
  );

-- Users can create PCs for themselves
CREATE POLICY "Users can create their own PCs"
  ON characters FOR INSERT
  WITH CHECK (
    (character_type = 'pc' AND owner_user_id = auth.uid())
    OR
    -- NPCs in their worlds
    (character_type IN ('npc', 'monster') AND world_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM worlds WHERE worlds.id = characters.world_id AND worlds.creator_user_id = auth.uid()
    ))
    OR
    -- NPCs in their projects (as GM)
    (character_type = 'npc' AND project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects WHERE projects.id = characters.project_id AND projects.gm_user_id = auth.uid()
    ))
  );

-- Users can update their own characters
CREATE POLICY "Users can update their own characters"
  ON characters FOR UPDATE
  USING (
    owner_user_id = auth.uid()
    OR
    (world_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM worlds WHERE worlds.id = characters.world_id AND worlds.creator_user_id = auth.uid()
    ))
    OR
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects WHERE projects.id = characters.project_id AND projects.gm_user_id = auth.uid()
    ))
  );

-- Similar for DELETE
CREATE POLICY "Users can delete their own characters"
  ON characters FOR DELETE
  USING (
    owner_user_id = auth.uid()
    OR
    (world_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM worlds WHERE worlds.id = characters.world_id AND worlds.creator_user_id = auth.uid()
    ))
    OR
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects WHERE projects.id = characters.project_id AND projects.gm_user_id = auth.uid()
    ))
  );

-- ============================================
-- 5. SPELLS & ABILITIES
-- ============================================

ALTER TABLE spells_abilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view official and own spells"
  ON spells_abilities FOR SELECT
  USING (is_official = true OR creator_user_id = auth.uid() OR is_marketplace_item = true);

CREATE POLICY "Users can create spells"
  ON spells_abilities FOR INSERT
  WITH CHECK (creator_user_id = auth.uid());

CREATE POLICY "Users can update their own spells"
  ON spells_abilities FOR UPDATE
  USING (creator_user_id = auth.uid());

CREATE POLICY "Users can delete their own spells"
  ON spells_abilities FOR DELETE
  USING (creator_user_id = auth.uid());

-- Character Spells junction table
ALTER TABLE character_spells_abilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their character spells"
  ON character_spells_abilities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = character_spells_abilities.character_id
      AND characters.owner_user_id = auth.uid()
    )
  );

-- ============================================
-- 6. ITEMS
-- ============================================

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view official and own items"
  ON items FOR SELECT
  USING (creator_user_id = auth.uid() OR is_marketplace_item = true);

CREATE POLICY "Users can create items"
  ON items FOR INSERT
  WITH CHECK (creator_user_id = auth.uid());

CREATE POLICY "Users can update their own items"
  ON items FOR UPDATE
  USING (creator_user_id = auth.uid());

CREATE POLICY "Users can delete their own items"
  ON items FOR DELETE
  USING (creator_user_id = auth.uid());

-- Character Inventory
ALTER TABLE character_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their character inventory"
  ON character_inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = character_inventory.character_id
      AND characters.owner_user_id = auth.uid()
    )
  );

-- ============================================
-- 7. PROJECTS
-- ============================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Security-definer helper avoids recursive project/project_members RLS while deriving
-- identity exclusively from auth.uid(). It exposes only a boolean authorization result.
CREATE OR REPLACE FUNCTION public.current_user_is_active_project_member(
  p_project_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_active_project_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_is_active_project_member(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_active_project_member(UUID) TO authenticated;

-- Users can view projects where they are GM
CREATE POLICY "Users can view projects where they are GM"
  ON projects FOR SELECT
  USING (gm_user_id = auth.uid());

-- Active members can view their joined project after membership was server/GM-controlled.
CREATE POLICY "Active members can view their projects"
  ON projects FOR SELECT
  USING (public.current_user_is_active_project_member(id));

CREATE POLICY "Users can create projects as GM"
  ON projects FOR INSERT
  WITH CHECK (gm_user_id = auth.uid());

CREATE POLICY "GM can update their projects"
  ON projects FOR UPDATE
  USING (gm_user_id = auth.uid());

CREATE POLICY "GM can delete their projects"
  ON projects FOR DELETE
  USING (gm_user_id = auth.uid());

-- ============================================
-- 8. PROJECT MEMBERS
-- ============================================

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Users can see their own member records
CREATE POLICY "Users can view their own project member records"
  ON project_members FOR SELECT
  USING (user_id = auth.uid());

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

-- Membership identity, role, project and status are GM/server controlled.
CREATE POLICY "GM can add members to their projects"
  ON project_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
      AND projects.gm_user_id = auth.uid()
    )
  );

CREATE POLICY "GM can update members in their projects"
  ON project_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
      AND projects.gm_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
      AND projects.gm_user_id = auth.uid()
    )
  );

-- A kicked membership stays as a denial record and cannot be self-deleted/reactivated.
CREATE POLICY "Users can leave active project memberships"
  ON project_members FOR DELETE
  USING (
    user_id = auth.uid()
    AND status IN ('active', 'inactive')
  );

-- GM can remove members
CREATE POLICY "GM can remove members from their projects"
  ON project_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_members.project_id
      AND projects.gm_user_id = auth.uid()
    )
  );

-- Joining by secret code is the only authenticated self-service path that can create
-- an active player membership. It does not accept role/status/user/project IDs from the client.
CREATE OR REPLACE FUNCTION public.join_project_by_code(
  p_code TEXT,
  p_character_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_project_id UUID;
  v_existing_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(BTRIM(p_code), '') IS NULL THEN
    RAISE EXCEPTION 'Project code is required' USING ERRCODE = '22023';
  END IF;

  SELECT id
  INTO v_project_id
  FROM public.projects
  WHERE UPPER(code) = UPPER(BTRIM(p_code))
    AND status = 'active'
  LIMIT 1;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT status
  INTO v_existing_status
  FROM public.project_members
  WHERE project_id = v_project_id
    AND user_id = v_user_id;

  IF FOUND THEN
    RAISE EXCEPTION 'Project membership already exists with status %', v_existing_status
      USING ERRCODE = 'P0001';
  END IF;

  IF p_character_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.characters
    WHERE id = p_character_id
      AND owner_user_id = v_user_id
      AND character_type = 'pc'
  ) THEN
    RAISE EXCEPTION 'Character is not owned by the current user' USING ERRCODE = '42501';
  END IF;

  IF p_character_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.characters
    WHERE id = p_character_id
      AND owner_user_id = v_user_id
      AND COALESCE(sheet_status, 'complete') <> 'complete'
  ) THEN
    RAISE EXCEPTION 'Unvollständige Charakterbögen können keinem Abenteuer beitreten'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.project_members (
    project_id,
    user_id,
    character_id,
    role,
    status
  ) VALUES (
    v_project_id,
    v_user_id,
    p_character_id,
    'player',
    'active'
  );

  RETURN v_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_project_by_code(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_project_by_code(TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_project_by_code(TEXT, UUID) TO authenticated;

-- Users may change only the selected PC for their own active membership.
CREATE OR REPLACE FUNCTION public.set_my_project_character(
  p_project_id UUID,
  p_character_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_member_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_character_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.characters
    WHERE id = p_character_id
      AND owner_user_id = v_user_id
      AND character_type = 'pc'
  ) THEN
    RAISE EXCEPTION 'Character is not owned by the current user' USING ERRCODE = '42501';
  END IF;

  IF p_character_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.characters
    WHERE id = p_character_id
      AND owner_user_id = v_user_id
      AND COALESCE(sheet_status, 'complete') <> 'complete'
  ) THEN
    RAISE EXCEPTION 'Unvollständige Charakterbögen können keinem Abenteuer zugewiesen werden'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.project_members
  SET character_id = p_character_id
  WHERE project_id = p_project_id
    AND user_id = v_user_id
    AND status = 'active'
  RETURNING id INTO v_member_id;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Active project membership not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_member_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_project_character(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_my_project_character(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_my_project_character(UUID, UUID) TO authenticated;

-- ============================================
-- 9. SESSIONS
-- ============================================

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

-- Players can view sessions in projects they're active members of
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

-- Session Participants
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view session participants"
  ON session_participants FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM sessions
      JOIN projects ON projects.id = sessions.project_id
      WHERE sessions.id = session_participants.session_id
      AND projects.gm_user_id = auth.uid()
    )
  );

-- ============================================
-- 10. COMBAT ENCOUNTERS
-- ============================================

ALTER TABLE combat_encounters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GM can manage combat in their projects"
  ON combat_encounters FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = combat_encounters.project_id
      AND projects.gm_user_id = auth.uid()
    )
  );

-- Players can view combat in projects where they are active members
CREATE POLICY "Players can view combat in their projects"
  ON combat_encounters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = combat_encounters.project_id
      AND project_members.user_id = auth.uid()
      AND project_members.status = 'active'
    )
  );

-- Combat Participants
ALTER TABLE combat_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view combat participants"
  ON combat_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM combat_encounters
      JOIN projects ON projects.id = combat_encounters.project_id
      WHERE combat_encounters.id = combat_participants.combat_encounter_id
      AND (
        projects.gm_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND project_members.status = 'active'
        )
      )
    )
  );

-- ============================================
-- 11. BATTLE MAPS
-- ============================================

ALTER TABLE battle_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public and own battle maps"
  ON battle_maps FOR SELECT
  USING (
    creator_user_id = auth.uid()
    OR is_marketplace_item = true
    OR (world_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM worlds WHERE worlds.id = battle_maps.world_id AND worlds.is_public = true
    ))
  );

CREATE POLICY "Users can create battle maps"
  ON battle_maps FOR INSERT
  WITH CHECK (creator_user_id = auth.uid());

CREATE POLICY "Users can update their own battle maps"
  ON battle_maps FOR UPDATE
  USING (creator_user_id = auth.uid());

CREATE POLICY "Users can delete their own battle maps"
  ON battle_maps FOR DELETE
  USING (creator_user_id = auth.uid());

-- Map Tokens
ALTER TABLE map_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage tokens in accessible maps"
  ON map_tokens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM battle_maps
      WHERE battle_maps.id = map_tokens.battle_map_id
      AND battle_maps.creator_user_id = auth.uid()
    )
    OR
    (combat_encounter_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM combat_encounters
      JOIN projects ON projects.id = combat_encounters.project_id
      WHERE combat_encounters.id = map_tokens.combat_encounter_id
      AND projects.gm_user_id = auth.uid()
    ))
  );

-- ============================================
-- 12. DICE ROLLS
-- ============================================

ALTER TABLE dice_rolls ENABLE ROW LEVEL SECURITY;

-- Users can view dice rolls in their sessions
CREATE POLICY "Users can view dice rolls in their sessions"
  ON dice_rolls FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    (session_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM sessions
      JOIN projects ON projects.id = sessions.project_id
      WHERE sessions.id = dice_rolls.session_id
      AND (
        projects.gm_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members
          WHERE project_members.project_id = projects.id
          AND project_members.user_id = auth.uid()
          AND project_members.status = 'active'
        )
      )
    ))
  );

CREATE POLICY "Users can create dice rolls"
  ON dice_rolls FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- 13. QUESTS
-- ============================================

ALTER TABLE quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accessible quests"
  ON quests FOR SELECT
  USING (
    (world_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM worlds WHERE worlds.id = quests.world_id AND worlds.is_public = true
    ))
    OR
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = quests.project_id
      AND project_members.user_id = auth.uid()
      AND project_members.status = 'active'
    ))
    OR
    creator_user_id = auth.uid()
  );

CREATE POLICY "Users can create quests"
  ON quests FOR INSERT
  WITH CHECK (creator_user_id = auth.uid());

CREATE POLICY "Users can update their quests"
  ON quests FOR UPDATE
  USING (creator_user_id = auth.uid());

CREATE POLICY "Users can delete their quests"
  ON quests FOR DELETE
  USING (creator_user_id = auth.uid());

-- ============================================
-- 14. AI CONTEXT
-- ============================================

ALTER TABLE ai_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view AI context for their content"
  ON ai_context FOR ALL
  USING (
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects WHERE projects.id = ai_context.project_id AND projects.gm_user_id = auth.uid()
    ))
    OR
    (character_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM characters WHERE characters.id = ai_context.character_id AND characters.owner_user_id = auth.uid()
    ))
  );

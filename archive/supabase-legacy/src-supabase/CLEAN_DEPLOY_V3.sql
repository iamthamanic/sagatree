-- ============================================
-- CLEAN DEPLOY: Drops old tables and creates fresh V3 schema
-- ⚠️ WARNING: THIS WILL DELETE ALL DATA!
-- ============================================

-- Step 1: Drop all existing tables (in reverse dependency order)
DROP TABLE IF EXISTS ai_context CASCADE;
DROP TABLE IF EXISTS marketplace_categories CASCADE;
DROP TABLE IF EXISTS quests CASCADE;
DROP TABLE IF EXISTS dice_rolls CASCADE;
DROP TABLE IF EXISTS map_tokens CASCADE;
DROP TABLE IF EXISTS battle_maps CASCADE;
DROP TABLE IF EXISTS combat_participants CASCADE;
DROP TABLE IF EXISTS combat_encounters CASCADE;
DROP TABLE IF EXISTS session_participants CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS character_inventory CASCADE;
DROP TABLE IF EXISTS character_spells_abilities CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS spells_abilities CASCADE;
DROP TABLE IF EXISTS characters CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS worlds CASCADE;
DROP TABLE IF EXISTS rulesets CASCADE;

-- ============================================
-- Step 2: Create fresh tables
-- ============================================

-- 1. RULESETS
CREATE TABLE rulesets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT,
  
  attributes_config JSONB NOT NULL DEFAULT '{
    "primary": ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"],
    "derived": ["hp", "ac", "speed", "initiative"]
  }',
  
  skills_config JSONB DEFAULT '[]',
  classes_config JSONB DEFAULT '[]',
  races_config JSONB DEFAULT '[]',
  combat_rules JSONB DEFAULT '{}',
  dice_rules JSONB DEFAULT '{}',
  level_progression JSONB DEFAULT '{}',
  
  is_official BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  is_marketplace_item BOOLEAN DEFAULT false,
  downloads_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. WORLDS
CREATE TABLE worlds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ruleset_id UUID REFERENCES rulesets(id) ON DELETE SET NULL,
  
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

-- 3. LOCATIONS
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  location_type TEXT,
  
  coordinates JSONB,
  image_url TEXT,
  map_image_url TEXT,
  
  is_public BOOLEAN DEFAULT false,
  parent_location_id UUID REFERENCES locations(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. PROJECTS
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gm_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  world_id UUID REFERENCES worlds(id) ON DELETE SET NULL,
  ruleset_id UUID REFERENCES rulesets(id),
  
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  
  current_session_number INTEGER DEFAULT 0,
  story_summary TEXT,
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. CHARACTERS
CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  parent_character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  
  character_type TEXT NOT NULL CHECK (character_type IN ('pc', 'npc', 'companion', 'monster')),
  
  ruleset_id UUID REFERENCES rulesets(id),
  
  name TEXT NOT NULL,
  race TEXT,
  class TEXT,
  level INTEGER DEFAULT 1,
  background_story TEXT,
  
  appearance JSONB DEFAULT '{}',
  portrait_url TEXT,
  token_url TEXT,
  
  attributes JSONB NOT NULL DEFAULT '{}',
  derived_stats JSONB DEFAULT '{}',
  
  skills JSONB DEFAULT '{}',
  proficiencies TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{}',
  
  hp_current INTEGER,
  hp_max INTEGER,
  armor_class INTEGER,
  initiative_bonus INTEGER DEFAULT 0,
  speed INTEGER DEFAULT 30,
  
  resources JSONB DEFAULT '{}',
  conditions TEXT[] DEFAULT '{}',
  
  personality_traits TEXT[],
  ideals TEXT,
  bonds TEXT,
  flaws TEXT,
  
  is_marketplace_item BOOLEAN DEFAULT false,
  downloads_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. SPELLS & ABILITIES
CREATE TABLE spells_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ruleset_id UUID REFERENCES rulesets(id),
  
  type TEXT NOT NULL CHECK (type IN ('spell', 'ability', 'feature', 'action')),
  
  name TEXT NOT NULL,
  description TEXT,
  level INTEGER,
  school TEXT,
  
  casting_time TEXT,
  range TEXT,
  duration TEXT,
  components JSONB,
  
  damage_dice TEXT,
  damage_type TEXT,
  effects JSONB,
  
  classes_allowed TEXT[],
  level_required INTEGER,
  
  is_official BOOLEAN DEFAULT false,
  is_marketplace_item BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE character_spells_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  spell_ability_id UUID NOT NULL REFERENCES spells_abilities(id) ON DELETE CASCADE,
  is_prepared BOOLEAN DEFAULT true,
  uses_remaining INTEGER,
  UNIQUE(character_id, spell_ability_id)
);

-- 7. ITEMS
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ruleset_id UUID REFERENCES rulesets(id),
  
  name TEXT NOT NULL,
  description TEXT,
  
  item_type TEXT NOT NULL CHECK (item_type IN (
    'weapon', 'armor', 'shield', 'consumable', 'tool', 'quest', 'treasure', 'misc'
  )),
  
  rarity TEXT DEFAULT 'common',
  weight DECIMAL(10,2),
  value INTEGER,
  
  image_url TEXT,
  
  damage_dice TEXT,
  damage_type TEXT,
  armor_class_bonus INTEGER,
  properties TEXT[],
  
  is_magical BOOLEAN DEFAULT false,
  attunement_required BOOLEAN DEFAULT false,
  magical_effects JSONB,
  
  is_stackable BOOLEAN DEFAULT false,
  
  is_marketplace_item BOOLEAN DEFAULT false,
  downloads_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE character_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  is_equipped BOOLEAN DEFAULT false,
  is_attuned BOOLEAN DEFAULT false,
  custom_notes TEXT
);

-- 8. PROJECT MEMBERS
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'player' CHECK (role IN ('gm', 'player')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'kicked')),
  UNIQUE(project_id, user_id)
);

-- 9. SESSIONS
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  session_number INTEGER NOT NULL,
  name TEXT,
  
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  
  gm_notes TEXT,
  summary TEXT,
  
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, session_number)
);

CREATE TABLE session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  left_at TIMESTAMPTZ,
  was_present BOOLEAN DEFAULT true,
  UNIQUE(session_id, user_id)
);

-- 10. COMBAT ENCOUNTERS
CREATE TABLE combat_encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  name TEXT,
  description TEXT,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  current_round INTEGER DEFAULT 0,
  current_turn_index INTEGER DEFAULT 0,
  
  combat_log JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE combat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combat_encounter_id UUID NOT NULL REFERENCES combat_encounters(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  
  initiative INTEGER NOT NULL,
  hp_current INTEGER,
  conditions TEXT[] DEFAULT '{}',
  
  has_acted_this_round BOOLEAN DEFAULT false,
  is_surprised BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. BATTLE MAPS
CREATE TABLE battle_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  
  image_url TEXT NOT NULL,
  
  grid_enabled BOOLEAN DEFAULT true,
  grid_size INTEGER DEFAULT 5,
  grid_columns INTEGER DEFAULT 20,
  grid_rows INTEGER DEFAULT 20,
  grid_type TEXT DEFAULT 'square' CHECK (grid_type IN ('square', 'hex')),
  
  is_marketplace_item BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE map_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_map_id UUID NOT NULL REFERENCES battle_maps(id) ON DELETE CASCADE,
  combat_encounter_id UUID REFERENCES combat_encounters(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  
  grid_x INTEGER NOT NULL,
  grid_y INTEGER NOT NULL,
  
  is_visible BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. DICE ROLLS
CREATE TABLE dice_rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  
  roll_type TEXT,
  dice_formula TEXT NOT NULL,
  result INTEGER NOT NULL,
  individual_rolls JSONB,
  
  description TEXT,
  is_advantage BOOLEAN DEFAULT false,
  is_disadvantage BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. QUESTS
CREATE TABLE quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  creator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  name TEXT NOT NULL,
  description TEXT,
  
  objectives JSONB DEFAULT '[]',
  rewards JSONB DEFAULT '{}',
  
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'active', 'completed', 'failed')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 14. MARKETPLACE CATEGORIES
CREATE TABLE marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  parent_category_id UUID REFERENCES marketplace_categories(id)
);

-- 15. AI CONTEXT
CREATE TABLE ai_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  
  context_type TEXT,
  prompt TEXT,
  response TEXT,
  model_used TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Step 3: Create indexes
-- ============================================

CREATE INDEX idx_rulesets_creator ON rulesets(creator_user_id);
CREATE INDEX idx_rulesets_marketplace ON rulesets(is_marketplace_item) WHERE is_marketplace_item = true;

CREATE INDEX idx_worlds_creator ON worlds(creator_user_id);
CREATE INDEX idx_worlds_ruleset ON worlds(ruleset_id);
CREATE INDEX idx_worlds_marketplace ON worlds(is_marketplace_item) WHERE is_marketplace_item = true;

CREATE INDEX idx_locations_world ON locations(world_id);
CREATE INDEX idx_locations_parent ON locations(parent_location_id);

CREATE INDEX idx_projects_gm ON projects(gm_user_id);
CREATE INDEX idx_projects_world ON projects(world_id);
CREATE INDEX idx_projects_code ON projects(code);

CREATE INDEX idx_characters_owner ON characters(owner_user_id);
CREATE INDEX idx_characters_world ON characters(world_id);
CREATE INDEX idx_characters_project ON characters(project_id);
CREATE INDEX idx_characters_parent ON characters(parent_character_id);
CREATE INDEX idx_characters_type ON characters(character_type);
CREATE INDEX idx_characters_marketplace ON characters(is_marketplace_item) WHERE is_marketplace_item = true;

CREATE INDEX idx_spells_creator ON spells_abilities(creator_user_id);
CREATE INDEX idx_spells_ruleset ON spells_abilities(ruleset_id);
CREATE INDEX idx_spells_type ON spells_abilities(type);

CREATE INDEX idx_items_creator ON items(creator_user_id);
CREATE INDEX idx_items_type ON items(item_type);
CREATE INDEX idx_items_marketplace ON items(is_marketplace_item) WHERE is_marketplace_item = true;

CREATE INDEX idx_inventory_character ON character_inventory(character_id);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

CREATE INDEX idx_sessions_project ON sessions(project_id);

CREATE INDEX idx_combat_participants_encounter ON combat_participants(combat_encounter_id);
CREATE INDEX idx_combat_participants_initiative ON combat_participants(combat_encounter_id, initiative DESC);

CREATE INDEX idx_dice_rolls_session ON dice_rolls(session_id);
CREATE INDEX idx_dice_rolls_user ON dice_rolls(user_id);

-- ============================================
-- Success message
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Tables created successfully!';
  RAISE NOTICE 'Next: Run schema_v3_rls.sql for Row Level Security';
END $$;

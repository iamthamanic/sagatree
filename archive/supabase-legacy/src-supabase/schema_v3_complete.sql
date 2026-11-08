-- ============================================
-- SagaTree - COMPLETE DATABASE SCHEMA V3
-- D&D-Style TTRPG Platform with flexible rulesets
-- ============================================

-- ============================================
-- 1. RULESETS (D&D 5e, DSA, Pathfinder, Custom)
-- ============================================

CREATE TABLE IF NOT EXISTS rulesets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL, -- "D&D 5e", "DSA 5", "Pathfinder 2e", "My Custom Rules"
  description TEXT,
  version TEXT, -- "5.0", "2.0", etc.
  
  -- Rule definitions (flexible JSONB structure)
  attributes_config JSONB NOT NULL DEFAULT '{
    "primary": ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"],
    "derived": ["hp", "ac", "speed", "initiative"]
  }', -- Which attributes exist and how they're calculated
  
  skills_config JSONB DEFAULT '[]', -- List of skills
  classes_config JSONB DEFAULT '[]', -- Available classes
  races_config JSONB DEFAULT '[]', -- Available races
  combat_rules JSONB DEFAULT '{}', -- Initiative, actions, bonus actions, etc.
  dice_rules JSONB DEFAULT '{}', -- Which dice are used, advantage/disadvantage
  level_progression JSONB DEFAULT '{}', -- How leveling works
  
  -- Metadata
  is_official BOOLEAN DEFAULT false, -- D&D 5e, DSA, etc.
  is_public BOOLEAN DEFAULT false, -- Shareable in marketplace
  is_marketplace_item BOOLEAN DEFAULT false,
  downloads_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rulesets_creator ON rulesets(creator_user_id);
CREATE INDEX idx_rulesets_marketplace ON rulesets(is_marketplace_item) WHERE is_marketplace_item = true;

-- ============================================
-- 2. WORLDS (Settings/Universes)
-- ============================================

CREATE TABLE IF NOT EXISTS worlds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ruleset_id UUID REFERENCES rulesets(id) ON DELETE SET NULL,
  
  name TEXT NOT NULL, -- "Forgotten Realms", "Eberron", "My Fantasy World"
  description TEXT,
  lore TEXT, -- Long-form world lore
  
  -- World properties
  setting_type TEXT, -- "fantasy", "sci-fi", "modern", "horror", "custom"
  tags TEXT[] DEFAULT '{}',
  cover_image_url TEXT,
  
  -- Marketplace
  is_public BOOLEAN DEFAULT false,
  is_marketplace_item BOOLEAN DEFAULT false,
  downloads_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2),
  price INTEGER DEFAULT 0, -- Credits (0 = free)
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_worlds_creator ON worlds(creator_user_id);
CREATE INDEX idx_worlds_ruleset ON worlds(ruleset_id);
CREATE INDEX idx_worlds_marketplace ON worlds(is_marketplace_item) WHERE is_marketplace_item = true;

-- ============================================
-- 3. LOCATIONS (Places in Worlds)
-- ============================================

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  location_type TEXT, -- "city", "dungeon", "wilderness", "building", "region"
  
  -- Coordinates (optional, for world maps)
  coordinates JSONB, -- {x: 100, y: 200} or {lat: 52.52, lon: 13.405}
  
  -- Visual
  image_url TEXT,
  map_image_url TEXT, -- Battle map for this location
  
  -- Metadata
  is_public BOOLEAN DEFAULT false,
  parent_location_id UUID REFERENCES locations(id), -- City in Region, Room in Building
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_locations_world ON locations(world_id);
CREATE INDEX idx_locations_parent ON locations(parent_location_id);

-- ============================================
-- 4. CHARACTERS (PC, NPC, Companion, Monster)
-- ============================================

CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ownership (depends on type)
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Only for PC
  world_id UUID REFERENCES worlds(id) ON DELETE CASCADE, -- For world-NPCs
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE, -- For project-specific NPCs
  parent_character_id UUID REFERENCES characters(id) ON DELETE CASCADE, -- For companions
  
  -- Type
  character_type TEXT NOT NULL CHECK (character_type IN ('pc', 'npc', 'companion', 'monster')),
  
  -- Ruleset
  ruleset_id UUID REFERENCES rulesets(id),
  
  -- Basic Info
  name TEXT NOT NULL,
  race TEXT,
  class TEXT,
  level INTEGER DEFAULT 1,
  background_story TEXT,
  
  -- Appearance
  appearance JSONB DEFAULT '{}', -- Portrait, physical description, etc.
  portrait_url TEXT,
  token_url TEXT, -- For battle maps
  
  -- Core Stats (flexible based on ruleset)
  attributes JSONB NOT NULL DEFAULT '{}', -- {"strength": 10, "dexterity": 14, ...}
  derived_stats JSONB DEFAULT '{}', -- {"hp_current": 25, "hp_max": 30, "ac": 15, ...}
  
  -- Skills & Proficiencies
  skills JSONB DEFAULT '{}', -- {"athletics": 2, "stealth": 5, ...}
  proficiencies TEXT[] DEFAULT '{}', -- ["light armor", "longswords"]
  languages TEXT[] DEFAULT '{}',
  
  -- Combat
  hp_current INTEGER,
  hp_max INTEGER,
  armor_class INTEGER,
  initiative_bonus INTEGER DEFAULT 0,
  speed INTEGER DEFAULT 30,
  
  -- Resources (spell slots, ki points, etc.)
  resources JSONB DEFAULT '{}', -- {"spell_slots_1": 4, "ki_points": 3}
  
  -- Conditions/Effects
  conditions TEXT[] DEFAULT '{}', -- ["poisoned", "blessed"]
  
  -- Personality (for NPCs/AI)
  personality_traits TEXT[],
  ideals TEXT,
  bonds TEXT,
  flaws TEXT,
  
  -- Marketplace
  is_marketplace_item BOOLEAN DEFAULT false,
  downloads_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_characters_owner ON characters(owner_user_id);
CREATE INDEX idx_characters_world ON characters(world_id);
CREATE INDEX idx_characters_project ON characters(project_id);
CREATE INDEX idx_characters_parent ON characters(parent_character_id);
CREATE INDEX idx_characters_type ON characters(character_type);
CREATE INDEX idx_characters_marketplace ON characters(is_marketplace_item) WHERE is_marketplace_item = true;

-- ============================================
-- 5. SPELLS & ABILITIES (Templates)
-- ============================================

CREATE TABLE IF NOT EXISTS spells_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ruleset_id UUID REFERENCES rulesets(id),
  
  type TEXT NOT NULL CHECK (type IN ('spell', 'ability', 'feature', 'action')),
  
  name TEXT NOT NULL,
  description TEXT,
  level INTEGER, -- Spell level (0 = cantrip) or ability tier
  school TEXT, -- "evocation", "necromancy", etc.
  
  -- Casting/Usage
  casting_time TEXT, -- "1 action", "1 bonus action", "1 minute"
  range TEXT, -- "60 feet", "Self", "Touch"
  duration TEXT, -- "Instantaneous", "1 hour", "Concentration, up to 10 minutes"
  components JSONB, -- {"verbal": true, "somatic": true, "material": "a pinch of sand"}
  
  -- Effects
  damage_dice TEXT, -- "3d6" or "1d8+3"
  damage_type TEXT, -- "fire", "slashing", "psychic"
  effects JSONB, -- Flexible effects structure
  
  -- Requirements
  classes_allowed TEXT[], -- ["wizard", "sorcerer"]
  level_required INTEGER,
  
  -- Marketplace
  is_official BOOLEAN DEFAULT false, -- From official rulebook
  is_marketplace_item BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_spells_creator ON spells_abilities(creator_user_id);
CREATE INDEX idx_spells_ruleset ON spells_abilities(ruleset_id);
CREATE INDEX idx_spells_type ON spells_abilities(type);

-- Character Spells/Abilities (Junction)
CREATE TABLE IF NOT EXISTS character_spells_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  spell_ability_id UUID NOT NULL REFERENCES spells_abilities(id) ON DELETE CASCADE,
  is_prepared BOOLEAN DEFAULT true, -- For prepared casters
  uses_remaining INTEGER, -- For limited-use abilities
  UNIQUE(character_id, spell_ability_id)
);

-- ============================================
-- 6. ITEMS (Equipment, Consumables, Quest Items)
-- ============================================

CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ruleset_id UUID REFERENCES rulesets(id),
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- Type
  item_type TEXT NOT NULL CHECK (item_type IN (
    'weapon', 'armor', 'shield', 'consumable', 'tool', 'quest', 'treasure', 'misc'
  )),
  
  -- Properties
  rarity TEXT DEFAULT 'common', -- common, uncommon, rare, very rare, legendary, artifact
  weight DECIMAL(10,2), -- in pounds/kg
  value INTEGER, -- in gold/credits
  
  -- Visual
  image_url TEXT,
  
  -- Weapon/Armor specific
  damage_dice TEXT, -- "1d8"
  damage_type TEXT, -- "slashing"
  armor_class_bonus INTEGER,
  properties TEXT[], -- ["finesse", "light", "versatile"]
  
  -- Magical properties
  is_magical BOOLEAN DEFAULT false,
  attunement_required BOOLEAN DEFAULT false,
  magical_effects JSONB,
  
  -- Stackable
  is_stackable BOOLEAN DEFAULT false, -- Arrows, potions, etc.
  
  -- Marketplace
  is_marketplace_item BOOLEAN DEFAULT false,
  downloads_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_items_creator ON items(creator_user_id);
CREATE INDEX idx_items_type ON items(item_type);
CREATE INDEX idx_items_marketplace ON items(is_marketplace_item) WHERE is_marketplace_item = true;

-- Character Inventory (Junction)
CREATE TABLE IF NOT EXISTS character_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  is_equipped BOOLEAN DEFAULT false,
  is_attuned BOOLEAN DEFAULT false,
  custom_notes TEXT
);

CREATE INDEX idx_inventory_character ON character_inventory(character_id);

-- ============================================
-- 7. PROJECTS (Campaigns)
-- ============================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gm_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  world_id UUID REFERENCES worlds(id) ON DELETE SET NULL,
  ruleset_id UUID REFERENCES rulesets(id),
  
  code TEXT NOT NULL UNIQUE, -- 6-digit join code
  name TEXT NOT NULL,
  description TEXT,
  
  -- Story tracking
  current_session_number INTEGER DEFAULT 0,
  story_summary TEXT, -- "So far in the campaign..."
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_projects_gm ON projects(gm_user_id);
CREATE INDEX idx_projects_world ON projects(world_id);
CREATE INDEX idx_projects_code ON projects(code);

-- ============================================
-- 8. PROJECT MEMBERS
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

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

-- ============================================
-- 9. SESSIONS (Individual Play Sessions)
-- ============================================

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  session_number INTEGER NOT NULL,
  name TEXT, -- "Session 5 - The Battle of Helm's Deep"
  
  -- Scheduling
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  
  -- Session content
  gm_notes TEXT, -- Pre-session notes
  summary TEXT, -- Post-session recap
  
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, session_number)
);

CREATE INDEX idx_sessions_project ON sessions(project_id);

-- Session Participants (who attended)
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

-- ============================================
-- 10. COMBAT ENCOUNTERS
-- ============================================

CREATE TABLE IF NOT EXISTS combat_encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  name TEXT, -- "Goblin Ambush", "Dragon Fight"
  description TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  current_round INTEGER DEFAULT 0,
  current_turn_index INTEGER DEFAULT 0,
  
  -- Combat log
  combat_log JSONB DEFAULT '[]', -- Array of events
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Combat Participants (Initiative Tracker)
CREATE TABLE IF NOT EXISTS combat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combat_encounter_id UUID NOT NULL REFERENCES combat_encounters(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  
  initiative INTEGER NOT NULL,
  hp_current INTEGER,
  conditions TEXT[] DEFAULT '{}',
  
  -- Turn tracking
  has_acted_this_round BOOLEAN DEFAULT false,
  is_surprised BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_combat_participants_encounter ON combat_participants(combat_encounter_id);
CREATE INDEX idx_combat_participants_initiative ON combat_participants(combat_encounter_id, initiative DESC);

-- ============================================
-- 11. BATTLE MAPS
-- ============================================

CREATE TABLE IF NOT EXISTS battle_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- Map image
  image_url TEXT NOT NULL,
  
  -- Grid settings
  grid_enabled BOOLEAN DEFAULT true,
  grid_size INTEGER DEFAULT 5, -- 5 feet per square
  grid_columns INTEGER DEFAULT 20,
  grid_rows INTEGER DEFAULT 20,
  grid_type TEXT DEFAULT 'square' CHECK (grid_type IN ('square', 'hex')),
  
  -- Marketplace
  is_marketplace_item BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Map Tokens (character positions)
CREATE TABLE IF NOT EXISTS map_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_map_id UUID NOT NULL REFERENCES battle_maps(id) ON DELETE CASCADE,
  combat_encounter_id UUID REFERENCES combat_encounters(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  
  -- Position
  grid_x INTEGER NOT NULL,
  grid_y INTEGER NOT NULL,
  
  -- Visibility
  is_visible BOOLEAN DEFAULT true, -- Hidden for players
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 12. DICE ROLLS (Audit Trail)
-- ============================================

CREATE TABLE IF NOT EXISTS dice_rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  
  -- Roll details
  roll_type TEXT, -- "attack", "damage", "saving_throw", "ability_check", "custom"
  dice_formula TEXT NOT NULL, -- "1d20+5", "3d6"
  result INTEGER NOT NULL,
  individual_rolls JSONB, -- [{"die": "d20", "result": 15}, {"modifier": 5}]
  
  -- Context
  description TEXT, -- "Strength saving throw"
  is_advantage BOOLEAN DEFAULT false,
  is_disadvantage BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dice_rolls_session ON dice_rolls(session_id);
CREATE INDEX idx_dice_rolls_user ON dice_rolls(user_id);

-- ============================================
-- 13. QUESTS
-- ============================================

CREATE TABLE IF NOT EXISTS quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID REFERENCES worlds(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  creator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- Quest details
  objectives JSONB DEFAULT '[]', -- [{"text": "Find the sword", "completed": false}]
  rewards JSONB DEFAULT '{}', -- {"xp": 1000, "gold": 500, "items": [...]}
  
  -- Status
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'active', 'completed', 'failed')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 14. MARKETPLACE CATEGORIES
-- ============================================

CREATE TABLE IF NOT EXISTS marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  parent_category_id UUID REFERENCES marketplace_categories(id)
);

-- ============================================
-- 15. AI CONTEXT (For future AI features)
-- ============================================

CREATE TABLE IF NOT EXISTS ai_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  
  context_type TEXT, -- "npc_dialogue", "story_generation", "description"
  prompt TEXT,
  response TEXT,
  model_used TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- RLS POLICIES
-- ============================================

-- (To be added - similar structure as before)
-- Users can see their own content
-- Public/marketplace items are visible to all
-- Project members can see project content
-- etc.

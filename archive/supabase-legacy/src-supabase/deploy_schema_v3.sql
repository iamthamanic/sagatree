-- ============================================
-- DEPLOY SCHEMA V3 - COMPLETE
-- Run this in Supabase SQL Editor
-- ============================================

-- First, run the complete schema
\i schema_v3_complete.sql

-- Then, apply RLS policies
\i schema_v3_rls.sql

-- ============================================
-- SEED DATA: D&D 5e Official Ruleset
-- ============================================

INSERT INTO rulesets (
  id,
  name,
  description,
  version,
  is_official,
  is_public,
  attributes_config,
  skills_config,
  classes_config,
  races_config,
  combat_rules,
  dice_rules
) VALUES (
  '00000000-0000-0000-0000-000000000001', -- Fixed UUID for D&D 5e
  'D&D 5e',
  'Dungeons & Dragons 5th Edition - The world''s greatest roleplaying game',
  '5.0',
  true,
  true,
  '{
    "primary": ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"],
    "derived": ["hp", "ac", "speed", "initiative", "proficiency_bonus"]
  }'::jsonb,
  '[
    {"name": "Athletics", "ability": "strength"},
    {"name": "Acrobatics", "ability": "dexterity"},
    {"name": "Sleight of Hand", "ability": "dexterity"},
    {"name": "Stealth", "ability": "dexterity"},
    {"name": "Arcana", "ability": "intelligence"},
    {"name": "History", "ability": "intelligence"},
    {"name": "Investigation", "ability": "intelligence"},
    {"name": "Nature", "ability": "intelligence"},
    {"name": "Religion", "ability": "intelligence"},
    {"name": "Animal Handling", "ability": "wisdom"},
    {"name": "Insight", "ability": "wisdom"},
    {"name": "Medicine", "ability": "wisdom"},
    {"name": "Perception", "ability": "wisdom"},
    {"name": "Survival", "ability": "wisdom"},
    {"name": "Deception", "ability": "charisma"},
    {"name": "Intimidation", "ability": "charisma"},
    {"name": "Performance", "ability": "charisma"},
    {"name": "Persuasion", "ability": "charisma"}
  ]'::jsonb,
  '[
    {"name": "Barbarian", "hit_die": "d12"},
    {"name": "Bard", "hit_die": "d8"},
    {"name": "Cleric", "hit_die": "d8"},
    {"name": "Druid", "hit_die": "d8"},
    {"name": "Fighter", "hit_die": "d10"},
    {"name": "Monk", "hit_die": "d8"},
    {"name": "Paladin", "hit_die": "d10"},
    {"name": "Ranger", "hit_die": "d10"},
    {"name": "Rogue", "hit_die": "d8"},
    {"name": "Sorcerer", "hit_die": "d6"},
    {"name": "Warlock", "hit_die": "d8"},
    {"name": "Wizard", "hit_die": "d6"}
  ]'::jsonb,
  '[
    {"name": "Human", "speed": 30, "size": "Medium"},
    {"name": "Elf", "speed": 30, "size": "Medium"},
    {"name": "Dwarf", "speed": 25, "size": "Medium"},
    {"name": "Halfling", "speed": 25, "size": "Small"},
    {"name": "Dragonborn", "speed": 30, "size": "Medium"},
    {"name": "Gnome", "speed": 25, "size": "Small"},
    {"name": "Half-Elf", "speed": 30, "size": "Medium"},
    {"name": "Half-Orc", "speed": 30, "size": "Medium"},
    {"name": "Tiefling", "speed": 30, "size": "Medium"}
  ]'::jsonb,
  '{
    "initiative": "1d20 + dex_modifier",
    "actions_per_turn": 1,
    "bonus_actions_per_turn": 1,
    "reactions_per_round": 1,
    "movement": "speed",
    "death_saves": {
      "successes_needed": 3,
      "failures_needed": 3,
      "critical_success": "restore_1_hp",
      "critical_failure": "2_failures"
    }
  }'::jsonb,
  '{
    "standard_set": ["d4", "d6", "d8", "d10", "d12", "d20", "d100"],
    "advantage": "roll_twice_take_higher",
    "disadvantage": "roll_twice_take_lower",
    "critical_hit": "natural_20",
    "critical_miss": "natural_1"
  }'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Schema V3 deployed successfully!';
  RAISE NOTICE '✅ D&D 5e ruleset created';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Verify tables in Table Editor';
  RAISE NOTICE '2. Test character creation';
  RAISE NOTICE '3. Create your first project!';
END $$;

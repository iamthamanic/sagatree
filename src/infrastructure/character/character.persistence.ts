/**
 * character.persistence — Persisted row shape for characters table.
 * Location: src/infrastructure/character/character.persistence.ts
 */
import type {
  AbilityDto,
  CharacterAppearanceDto,
  CharacterAttributeStorageDto,
  CharacterRulesetKey,
  EmotionProfileDto,
  ItemDto,
  SagaTreeSkillKey,
} from '../../domains/character/domain/character.entity';
import type { SagaTreeProfileDto } from '../../domains/character/domain/sagatree-profile.entity';

export interface CharacterDto {
  id: string;
  /** Immutable public character id (CH-XXXXX). */
  public_id?: string;
  owner_user_id: string;
  world_id?: string;
  project_id?: string;
  parent_character_id?: string;
  character_type: 'pc' | 'npc' | 'companion' | 'monster' | 'gm_presence';
  ruleset_id?: string;
  ruleset_key?: CharacterRulesetKey;
  name: string;
  description: string;
  class: string;
  race: string;
  level: number;
  background_story?: string;
  dnd_background?: string | null;
  notes?: string | null;
  appearance: CharacterAppearanceDto;
  portrait_url?: string;
  token_url?: string;
  attributes: CharacterAttributeStorageDto;
  derived_stats?: Record<string, unknown>;
  skills?: Partial<Record<SagaTreeSkillKey, number>>;
  proficiencies?: string[];
  languages?: string[];
  hp_current?: number;
  hp_max?: number;
  armor_class?: number;
  initiative_bonus?: number;
  speed?: number;
  resources?: Record<string, unknown>;
  conditions?: string[];
  /** Canonical SagaTree Core profile column (073+). */
  sagatree_profile?: Partial<SagaTreeProfileDto> | null;
  personality_traits?: string[];
  ideals?: string[];
  bonds?: string[];
  flaws?: string[];
  abilities: AbilityDto[];
  inventory: ItemDto[];
  /** Present when inventory_schema_version === 2; authoritative Inventory v2 state. */
  inventory_v2?: unknown | null;
  inventory_schema_version?: 1 | 2;
  emotion_profiles: EmotionProfileDto[];
  /** complete | incomplete — drafts may skip full SagaTree build asserts. */
  sheet_status?: 'complete' | 'incomplete';
  is_marketplace_item?: boolean;
  downloads_count?: number;
  rating?: number;
  created_at: string;
  updated_at: string;
}

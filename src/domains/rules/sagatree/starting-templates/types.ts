/**
 * starting-templates types — species-neutral Level-1 SagaTree start builds (#463).
 * Location: src/domains/rules/sagatree/starting-templates/types.ts
 *
 * Pure domain: no React, backend clients, race/appearance/inventory fields.
 */
import type { CharacterAttributesDto } from '../../../character/domain/character.entity';
import type {
  SagaTreeArchetypeKey,
  SagaTreeEssenceKey,
  SagaTreeSkillKey,
} from '../character-creation';
import type {
  SagaTreeBackgroundSkillPoints,
  SagaTreeSkillRankMap,
  SagaTreeSpecializationRecordDto,
  SagaTreeStartSkillBuild,
} from '../skill-progression';

export const SAGA_TREE_STARTING_TEMPLATE_KEYS = [
  'berserker',
  'vanguard',
  'mage',
  'technomancer',
  'medicus',
  'mystic',
  'assassin',
  'mechanom',
  'mentalist',
  'herald',
] as const;

export type SagaTreeStartingTemplateKey =
  (typeof SAGA_TREE_STARTING_TEMPLATE_KEYS)[number];

export type SagaTreeStartingTemplate = {
  readonly key: SagaTreeStartingTemplateKey;
  readonly labelDe: string;
  /** Short DE playstyle blurb for picker tooltips (what / how / when to pick). */
  readonly summaryDe: string;
  readonly archetype: SagaTreeArchetypeKey;
  readonly essence: SagaTreeEssenceKey;
  /** Base attributes — permutation of [4,3,3,2,2,1]. */
  readonly attributes: CharacterAttributesDto;
  readonly backgroundTemplateId: string;
  readonly freeSkillRanks: SagaTreeSkillRankMap;
  readonly backgroundSkillPoints: SagaTreeBackgroundSkillPoints;
  readonly archetypeTrainingSkill: SagaTreeSkillKey;
  /** Exactly one Level-1 background specialization. */
  readonly backgroundSpecialization: SagaTreeSpecializationRecordDto;
};

export type SagaTreeStartingTemplateSkillBuild = SagaTreeStartSkillBuild & {
  readonly archetypeTrainingSkill: SagaTreeSkillKey;
};

export function isSagaTreeStartingTemplateKey(
  value: string,
): value is SagaTreeStartingTemplateKey {
  return (SAGA_TREE_STARTING_TEMPLATE_KEYS as readonly string[]).includes(value);
}

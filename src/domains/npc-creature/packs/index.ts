/**
 * Builtin NPC/creature packs — Fantasy Basics, Tiere, context packs (#199).
 * Location: src/domains/npc-creature/packs/index.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type { NpcCreatureDefinition } from '../definition';
import type { NpcCreaturePack } from '../pack';
import { ANIMALS_DEFINITIONS, ANIMALS_PACK, ANIMALS_PACK_ID } from './animals';
import { CONTEXT_EXCLUSIVE_DEFINITIONS, CONTEXT_PACKS } from './context-packs';
import {
  FANTASY_BASICS_DEFINITIONS,
  FANTASY_BASICS_PACK,
  FANTASY_BASICS_PACK_ID,
} from './fantasy-basics';

export { ANIMALS_PACK_ID, FANTASY_BASICS_PACK_ID };

/** The two versioned base packs. */
export const BASE_NPC_CREATURE_PACKS: readonly NpcCreaturePack[] = Object.freeze([
  FANTASY_BASICS_PACK,
  ANIMALS_PACK,
]);

/** All packs (base + context). */
export const ALL_NPC_CREATURE_PACKS: readonly NpcCreaturePack[] = Object.freeze([
  ...BASE_NPC_CREATURE_PACKS,
  ...CONTEXT_PACKS,
]);

/** All builtin definitions shipped with packs (base + context exclusives). */
export const BUILTIN_NPC_CREATURE_DEFINITIONS: readonly NpcCreatureDefinition[] = Object.freeze([
  ...FANTASY_BASICS_DEFINITIONS,
  ...ANIMALS_DEFINITIONS,
  ...CONTEXT_EXCLUSIVE_DEFINITIONS,
]);

const DEFINITION_BY_ID: ReadonlyMap<string, NpcCreatureDefinition> = new Map(
  BUILTIN_NPC_CREATURE_DEFINITIONS.map((definition) => [definition.id, definition]),
);

const PACK_BY_ID: ReadonlyMap<string, NpcCreaturePack> = new Map(
  ALL_NPC_CREATURE_PACKS.map((pack) => [pack.id, pack]),
);

export function getBuiltinNpcCreatureDefinition(
  definitionId: string,
): NpcCreatureDefinition | undefined {
  return DEFINITION_BY_ID.get(definitionId);
}

export function listBuiltinNpcCreatureDefinitions(): readonly NpcCreatureDefinition[] {
  return BUILTIN_NPC_CREATURE_DEFINITIONS;
}

export function getNpcCreaturePack(packId: string): NpcCreaturePack | undefined {
  return PACK_BY_ID.get(packId);
}

export function listNpcCreaturePacks(): readonly NpcCreaturePack[] {
  return ALL_NPC_CREATURE_PACKS;
}

export function listBaseNpcCreaturePacks(): readonly NpcCreaturePack[] {
  return BASE_NPC_CREATURE_PACKS;
}

export function listContextNpcCreaturePacks(): readonly NpcCreaturePack[] {
  return CONTEXT_PACKS;
}

export {
  ANIMALS_DEFINITIONS,
  ANIMALS_PACK,
  CONTEXT_EXCLUSIVE_DEFINITIONS,
  CONTEXT_PACKS,
  FANTASY_BASICS_DEFINITIONS,
  FANTASY_BASICS_PACK,
};

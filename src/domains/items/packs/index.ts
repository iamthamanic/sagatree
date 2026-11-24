/**
 * Builtin item packs — Fantasy / Sci-Fi / Contemporary base + context packs (#137).
 * Location: src/domains/items/packs/index.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type { ItemDefinition } from '../definition';
import type { ItemPack } from '../pack';
import {
  CONTEMPORARY_BASIC_DEFINITIONS,
  CONTEMPORARY_BASIC_PACK,
} from './contemporary-basic';
import { CONTEXT_PACKS } from './context-packs';
import { FANTASY_BASIC_DEFINITIONS, FANTASY_BASIC_PACK } from './fantasy-basic';
import { SCIFI_BASIC_DEFINITIONS, SCIFI_BASIC_PACK } from './scifi-basic';

export { builtinDefinitionIdToIconKey } from './build-standard-item';

/** Exact size of each base pack — completeness gate. */
export const BASE_PACK_SIZE = 40;

/** Stable base pack ids. */
export const FANTASY_BASIC_PACK_ID = 'builtin:fantasy-basic' as const;
export const SCIFI_BASIC_PACK_ID = 'builtin:scifi-basic' as const;
export const CONTEMPORARY_BASIC_PACK_ID = 'builtin:contemporary-basic' as const;

/** The three versioned base packs. */
export const BASE_PACKS: readonly ItemPack[] = Object.freeze([
  FANTASY_BASIC_PACK,
  SCIFI_BASIC_PACK,
  CONTEMPORARY_BASIC_PACK,
]);

/** All packs (base + context). */
export const ALL_ITEM_PACKS: readonly ItemPack[] = Object.freeze([
  ...BASE_PACKS,
  ...CONTEXT_PACKS,
]);

/** All builtin-standard definitions from the three base packs (120). */
export const BUILTIN_STANDARD_DEFINITIONS: readonly ItemDefinition[] = Object.freeze([
  ...FANTASY_BASIC_DEFINITIONS,
  ...SCIFI_BASIC_DEFINITIONS,
  ...CONTEMPORARY_BASIC_DEFINITIONS,
]);

const DEFINITION_BY_ID: ReadonlyMap<string, ItemDefinition> = new Map(
  BUILTIN_STANDARD_DEFINITIONS.map((definition) => [definition.id, definition]),
);

const PACK_BY_ID: ReadonlyMap<string, ItemPack> = new Map(
  ALL_ITEM_PACKS.map((pack) => [pack.id, pack]),
);

/** Resolve a builtin-standard definition by id. */
export function getBuiltinStandardDefinition(
  definitionId: string,
): ItemDefinition | undefined {
  return DEFINITION_BY_ID.get(definitionId);
}

/** List all builtin-standard definitions (Fantasy + Sci-Fi + Contemporary). */
export function listBuiltinStandardDefinitions(): readonly ItemDefinition[] {
  return BUILTIN_STANDARD_DEFINITIONS;
}

/** Resolve any known item pack by stable id. */
export function getItemPack(packId: string): ItemPack | undefined {
  return PACK_BY_ID.get(packId);
}

/** List all item packs (base + context). */
export function listItemPacks(): readonly ItemPack[] {
  return ALL_ITEM_PACKS;
}

/** List the three base packs only. */
export function listBaseItemPacks(): readonly ItemPack[] {
  return BASE_PACKS;
}

/** List context packs only. */
export function listContextItemPacks(): readonly ItemPack[] {
  return CONTEXT_PACKS;
}

/**
 * Stress-test fixture combinations documented for acceptance (#137).
 * Each entry is base pack + context pack ids that a world might activate later.
 */
export const STRESS_TEST_PACK_COMBINATIONS: readonly {
  id: string;
  label: string;
  packIds: readonly string[];
}[] = Object.freeze([
  {
    id: 'fantasy-adventure',
    label: 'Fantasy-Abenteuer',
    packIds: Object.freeze([
      FANTASY_BASIC_PACK_ID,
      'builtin:context-adventure',
      'builtin:context-survival',
    ]),
  },
  {
    id: 'space-scifi',
    label: 'Space-Sci-Fi',
    packIds: Object.freeze([
      SCIFI_BASIC_PACK_ID,
      'builtin:context-space',
      'builtin:context-science',
      'builtin:context-engineering',
      'builtin:context-medical',
    ]),
  },
  {
    id: 'contemporary-office',
    label: 'Contemporary Office',
    packIds: Object.freeze([
      CONTEMPORARY_BASIC_PACK_ID,
      'builtin:context-office',
      'builtin:context-social',
    ]),
  },
  {
    id: 'contemporary-social-domestic',
    label: 'Contemporary Social/Domestic',
    packIds: Object.freeze([
      CONTEMPORARY_BASIC_PACK_ID,
      'builtin:context-social',
      'builtin:context-domestic',
    ]),
  },
  {
    id: 'contemporary-sports',
    label: 'Contemporary Sports',
    packIds: Object.freeze([
      CONTEMPORARY_BASIC_PACK_ID,
      'builtin:context-sports',
      'builtin:context-office',
      'builtin:context-medical',
    ]),
  },
  {
    id: 'contemporary-urban-survival',
    label: 'Contemporary Urban/Survival',
    packIds: Object.freeze([
      CONTEMPORARY_BASIC_PACK_ID,
      'builtin:context-urban',
      'builtin:context-survival',
    ]),
  },
]);

export {
  CONTEMPORARY_BASIC_DEFINITIONS,
  CONTEMPORARY_BASIC_PACK,
  CONTEXT_PACKS,
  FANTASY_BASIC_DEFINITIONS,
  FANTASY_BASIC_PACK,
  SCIFI_BASIC_DEFINITIONS,
  SCIFI_BASIC_PACK,
};

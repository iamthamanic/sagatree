/**
 * normalizeItemDefinition — fill safe taxonomy defaults for legacy definitions.
 * Location: src/domains/items/normalize.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type { InventoryItemType, ItemDefinitionScope } from '../character/inventory-v2/primitives';
import type { ItemDefinition } from './definition';
import type { ItemKindKey, ItemOrigin } from './taxonomy';

/** Default kindKey when only InventoryItemType is known. */
const KIND_KEY_FROM_TYPE: Record<InventoryItemType, ItemKindKey> = {
  weapon: 'weapon',
  armor: 'armor',
  shield: 'shield',
  tool: 'tool',
  consumable: 'consumable',
  container: 'container',
  misc: 'misc',
};

/** Default origin from catalog scope (builtin-standard is never inferred). */
const ORIGIN_FROM_SCOPE: Record<ItemDefinitionScope, ItemOrigin> = {
  core: 'core-archetype',
  world: 'world',
  personal: 'personal',
};

/**
 * Returns a definition with kindKey and origin filled when absent.
 * Does not invent settingTags/techLevel/contexts/capabilities/roles;
 * empty arrays remain valid when callers supply them.
 */
export function normalizeItemDefinition(def: ItemDefinition): ItemDefinition {
  return {
    ...def,
    kindKey: def.kindKey ?? KIND_KEY_FROM_TYPE[def.type],
    origin: def.origin ?? ORIGIN_FROM_SCOPE[def.scope],
  };
}

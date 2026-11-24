/**
 * inventory-v2 primitives — inventory behavior contracts without ItemDefinition.
 * Split from types.ts so `domains/items` can own ItemDefinition without a
 * circular import through this module.
 * Location: src/domains/character/inventory-v2/primitives.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 *
 * ItemLoad / ItemCost / MinimumStrength / ItemProtection are owned by the
 * SagaTree items rules kernel (`domains/rules/sagatree/items`) and re-exported
 * here for Inventory v2 compatibility (#135).
 */

import type {
  ItemCost,
  ItemLoad,
  ItemProtection,
  MinimumStrength,
} from '../../rules/sagatree/items';

export type { ItemCost, ItemLoad, ItemProtection, MinimumStrength };

/**
 * Where a catalog definition comes from. Ownership (which world profile, which
 * user) is resolved by the catalog/persistence layer — never trusted from
 * character state.
 */
export type ItemDefinitionScope = 'core' | 'world' | 'personal';

/** Item type. Drives the deterministic base-grid sort; `container` marks container definitions. */
export type InventoryItemType =
  | 'weapon'
  | 'armor'
  | 'shield'
  | 'tool'
  | 'consumable'
  | 'container'
  | 'misc';

/** The eight named equipment positions (incl. feet / Schuhe). */
export type EquipmentSlot =
  | 'head'
  | 'body'
  | 'accessory1'
  | 'accessory2'
  | 'mainHand'
  | 'offHand'
  | 'special'
  | 'feet';

/** Single source of truth for equipment-slot iteration order. */
export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  'head',
  'body',
  'accessory1',
  'accessory2',
  'mainHand',
  'offHand',
  'special',
  'feet',
];

/** The two hand references a two-handed item occupies. */
export const HAND_SLOTS: readonly EquipmentSlot[] = ['mainHand', 'offHand'];

/** Exactly 20 base positions. Strength never changes this count. */
export const BASE_SLOT_COUNT = 20;

/** Exactly 4 ordered quick-access references. */
export const QUICK_SLOT_COUNT = 4;

/** Schema marker for persisted inventory state (#109 migrates onto this version). */
export const INVENTORY_V2_SCHEMA_VERSION = 1;

/**
 * Deterministic base-grid sort order by type.
 * weapon → armor → shield → tool → consumable → container → misc
 */
export const SORT_TYPE_ORDER: readonly InventoryItemType[] = [
  'weapon',
  'armor',
  'shield',
  'tool',
  'consumable',
  'container',
  'misc',
];

/** Mechanical metadata carried over from the legacy `ItemDto` shape. */
export interface ItemMechanics {
  damage?: string;
  damageType?: string;
  protection?: ItemProtection;
  traits?: string[];
}

/** Equip prerequisites. Unmet prerequisites block equipping, never ownership. */
export interface ItemRequirements {
  minimumStrength?: MinimumStrength;
}

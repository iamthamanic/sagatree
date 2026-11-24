/**
 * sagatree item rule types — §5.7 / §8.3 / §10 load, cost, protection, traits.
 * Location: src/domains/rules/sagatree/items/types.ts
 *
 * Domain-pure: no React, no backend clients, no inventory state.
 */

/** Load points per unit (§10.2). */
export type ItemLoad = 0 | 1 | 2 | 3;

/** Abstract cost 0–5 (§10.3). Owning an item is not a purchase. */
export type ItemCost = 0 | 1 | 2 | 3 | 4 | 5;

/** Minimum-strength values for personal armor (§8.3). */
export type MinimumStrength = 1 | 2 | 4;

/** Personal equipment protection (§8.3); max 3 for normal gear. */
export type ItemProtection = 1 | 2 | 3;

/**
 * Universal weapon trait names from Core §10.1 (excluding parameterized
 * `Durchdringung X`, which uses {@link DURCHDRINGUNG_TRAIT_PATTERN}).
 */
export const SAGA_TREE_WEAPON_TRAIT_NAMES = [
  'Finesse',
  'Reichweite',
  'Wurf',
  'Zweihändig',
  'Laden',
  'Nichttödlich',
  'Verbergbar',
  'Fläche',
  'Laut',
  'Schwer',
] as const;

export type SagaTreeWeaponTraitName = (typeof SAGA_TREE_WEAPON_TRAIT_NAMES)[number];

/** Parameterized penetration trait: `Durchdringung X` with X ≥ 1 (§10.1). */
export const DURCHDRINGUNG_TRAIT_PATTERN = /^Durchdringung ([1-9]\d*)$/;

/**
 * Additional trait strings used by the Core catalog that are not in the
 * §10.1 weapon-trait list (shield defense / hand occupancy).
 */
export const SAGA_TREE_CORE_CATALOG_EXTRA_TRAITS = ['+1 Verteidigung', '1 Hand'] as const;

export type SagaTreeCoreCatalogExtraTrait = (typeof SAGA_TREE_CORE_CATALOG_EXTRA_TRAITS)[number];

/** Canonical protection → minimum-strength pairing from §8.3. */
export const PROTECTION_MINIMUM_STRENGTH: Readonly<Record<ItemProtection, MinimumStrength>> = {
  1: 1,
  2: 2,
  3: 4,
};

export const ITEM_LOAD_VALUES = [0, 1, 2, 3] as const satisfies readonly ItemLoad[];
export const ITEM_COST_VALUES = [0, 1, 2, 3, 4, 5] as const satisfies readonly ItemCost[];
export const MINIMUM_STRENGTH_VALUES = [1, 2, 4] as const satisfies readonly MinimumStrength[];
export const ITEM_PROTECTION_VALUES = [1, 2, 3] as const satisfies readonly ItemProtection[];

/**
 * sagatree item rule validators — fail-closed parsers for untrusted values.
 * Location: src/domains/rules/sagatree/items/validators.ts
 *
 * Domain-pure: no React, no backend clients, no inventory state.
 */

import {
  DURCHDRINGUNG_TRAIT_PATTERN,
  ITEM_COST_VALUES,
  ITEM_LOAD_VALUES,
  ITEM_PROTECTION_VALUES,
  MINIMUM_STRENGTH_VALUES,
  PROTECTION_MINIMUM_STRENGTH,
  SAGA_TREE_CORE_CATALOG_EXTRA_TRAITS,
  SAGA_TREE_WEAPON_TRAIT_NAMES,
  type ItemCost,
  type ItemLoad,
  type ItemProtection,
  type MinimumStrength,
  type SagaTreeWeaponTraitName,
} from './types';

export type ItemRuleParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function isItemLoad(value: unknown): value is ItemLoad {
  return typeof value === 'number' && (ITEM_LOAD_VALUES as readonly number[]).includes(value);
}

export function isItemCost(value: unknown): value is ItemCost {
  return typeof value === 'number' && (ITEM_COST_VALUES as readonly number[]).includes(value);
}

export function isMinimumStrength(value: unknown): value is MinimumStrength {
  return typeof value === 'number' && (MINIMUM_STRENGTH_VALUES as readonly number[]).includes(value);
}

export function isItemProtection(value: unknown): value is ItemProtection {
  return typeof value === 'number' && (ITEM_PROTECTION_VALUES as readonly number[]).includes(value);
}

export function parseItemLoad(value: unknown): ItemRuleParseResult<ItemLoad> {
  if (isItemLoad(value)) return { ok: true, value };
  return { ok: false, error: 'ItemLoad must be 0, 1, 2, or 3' };
}

export function parseItemCost(value: unknown): ItemRuleParseResult<ItemCost> {
  if (isItemCost(value)) return { ok: true, value };
  return { ok: false, error: 'ItemCost must be an integer from 0 to 5' };
}

export function parseMinimumStrength(value: unknown): ItemRuleParseResult<MinimumStrength> {
  if (isMinimumStrength(value)) return { ok: true, value };
  return { ok: false, error: 'MinimumStrength must be 1, 2, or 4' };
}

export function parseItemProtection(value: unknown): ItemRuleParseResult<ItemProtection> {
  if (isItemProtection(value)) return { ok: true, value };
  return { ok: false, error: 'ItemProtection must be 1, 2, or 3' };
}

export function isSagaTreeWeaponTraitName(value: string): value is SagaTreeWeaponTraitName {
  return (SAGA_TREE_WEAPON_TRAIT_NAMES as readonly string[]).includes(value);
}

/** True for `Durchdringung X` with X ≥ 1. */
export function isDurchdringungTrait(value: string): boolean {
  return DURCHDRINGUNG_TRAIT_PATTERN.test(value);
}

/** Extracts penetration points from `Durchdringung X`, or null when not matching. */
export function parseDurchdringungPoints(value: string): number | null {
  const match = DURCHDRINGUNG_TRAIT_PATTERN.exec(value);
  if (!match) return null;
  const points = Number(match[1]);
  return Number.isFinite(points) ? points : null;
}

/**
 * §10.1 weapon trait (named or parameterized Durchdringung).
 * Does not invent numeric bonuses for free-form trait strings.
 */
export function isSagaTreeWeaponTrait(value: string): boolean {
  return isSagaTreeWeaponTraitName(value) || isDurchdringungTrait(value);
}

/** Traits accepted by Core catalog entries (weapon traits + shield extras). */
export function isSagaTreeCoreCatalogTrait(value: string): boolean {
  return (
    isSagaTreeWeaponTrait(value) ||
    (SAGA_TREE_CORE_CATALOG_EXTRA_TRAITS as readonly string[]).includes(value)
  );
}

export function expectedMinimumStrengthForProtection(protection: ItemProtection): MinimumStrength {
  return PROTECTION_MINIMUM_STRENGTH[protection];
}

/**
 * Checks that armor protection and minimumStrength follow §8.3 when both are set.
 * Absent fields are allowed (narrative / non-armor items).
 */
export function validateProtectionMinimumStrengthPair(
  protection: ItemProtection | undefined,
  minimumStrength: MinimumStrength | undefined,
): ItemRuleParseResult<void> {
  if (protection === undefined || minimumStrength === undefined) {
    return { ok: true, value: undefined };
  }
  const expected = expectedMinimumStrengthForProtection(protection);
  if (minimumStrength !== expected) {
    return {
      ok: false,
      error: `Schutz ${protection} requires Mindeststärke ${expected}, got ${minimumStrength}`,
    };
  }
  return { ok: true, value: undefined };
}

/** Mechanical fields that Inventory v2 / Core already assume for rule-typed items. */
export interface ItemMechanicalRuleInput {
  load: unknown;
  cost: unknown;
  protection?: unknown;
  minimumStrength?: unknown;
  traits?: unknown;
}

export interface ValidatedItemMechanicalRules {
  load: ItemLoad;
  cost: ItemCost;
  protection?: ItemProtection;
  minimumStrength?: MinimumStrength;
  traits?: string[];
}

/**
 * Validates Core/Inventory mechanical combinations. Narrative items may omit
 * protection, minimumStrength, and traits; load and cost remain required.
 */
export function validateItemMechanicalRules(
  input: ItemMechanicalRuleInput,
): ItemRuleParseResult<ValidatedItemMechanicalRules> {
  const load = parseItemLoad(input.load);
  if (load.ok === false) return { ok: false, error: load.error };

  const cost = parseItemCost(input.cost);
  if (cost.ok === false) return { ok: false, error: cost.error };

  let protection: ItemProtection | undefined;
  if (input.protection !== undefined) {
    const parsed = parseItemProtection(input.protection);
    if (parsed.ok === false) return { ok: false, error: parsed.error };
    protection = parsed.value;
  }

  let minimumStrength: MinimumStrength | undefined;
  if (input.minimumStrength !== undefined) {
    const parsed = parseMinimumStrength(input.minimumStrength);
    if (parsed.ok === false) return { ok: false, error: parsed.error };
    minimumStrength = parsed.value;
  }

  const pair = validateProtectionMinimumStrengthPair(protection, minimumStrength);
  if (pair.ok === false) return { ok: false, error: pair.error };

  let traits: string[] | undefined;
  if (input.traits !== undefined) {
    if (!Array.isArray(input.traits)) {
      return { ok: false, error: 'traits must be an array of strings' };
    }
    const normalized: string[] = [];
    for (const trait of input.traits) {
      if (typeof trait !== 'string' || trait.trim().length === 0) {
        return { ok: false, error: 'each trait must be a non-empty string' };
      }
      normalized.push(trait.trim());
    }
    traits = normalized;
  }

  const value: ValidatedItemMechanicalRules = {
    load: load.value,
    cost: cost.value,
  };
  if (protection !== undefined) value.protection = protection;
  if (minimumStrength !== undefined) value.minimumStrength = minimumStrength;
  if (traits !== undefined && traits.length > 0) value.traits = traits;
  return { ok: true, value };
}

/**
 * Core catalog traits must match §10.1 weapon traits or the known shield extras.
 * World/personal free-form traits are out of scope for this check.
 */
export function validateCoreCatalogTraits(traits: readonly string[] | undefined): ItemRuleParseResult<string[]> {
  if (traits === undefined || traits.length === 0) {
    return { ok: true, value: [] };
  }
  for (const trait of traits) {
    if (!isSagaTreeCoreCatalogTrait(trait)) {
      return { ok: false, error: `unknown Core catalog trait ${JSON.stringify(trait)}` };
    }
  }
  return { ok: true, value: [...traits] };
}

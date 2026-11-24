/**
 * sagatree abstract resources & affordability — §10.3 + issue #32 editor rules.
 * Location: src/domains/rules/sagatree/items/resource-affordability.ts
 *
 * UI shows a single current level (0–5). Shape is extensible with optional `base`
 * for a later base/current dual bookkeeping UI without rewrite.
 *
 * Domain-pure: no React, no backend clients, no inventory state.
 */
import type { ItemCost } from './types';
import { isItemCost } from './validators';

export const ABSTRACT_RESOURCE_LEVELS = [0, 1, 2, 3, 4, 5] as const;
export type AbstractResourceLevel = (typeof ABSTRACT_RESOURCE_LEVELS)[number];

/** Default character abstract resources when unset (§10.3 / #32 decision 5a). */
export const DEFAULT_ABSTRACT_RESOURCE_LEVEL: AbstractResourceLevel = 3;

/** Key inside `characters.resources` JSONB for the SagaTree abstract pool. */
export const RESOURCES_JSONB_KEY = 'sagatreeAbstract';

/**
 * Character abstract resources.
 * `current` is the single number shown in the editor today.
 * `base` is reserved for a future dual UI — optional, not required on write.
 */
export interface CharacterAbstractResources {
  current: AbstractResourceLevel;
  base?: AbstractResourceLevel;
}

export type AffordabilityKind =
  | 'allow-free'
  | 'require-purchase-choice'
  | 'blocked-needs-gift-override';

export interface AffordabilityDecision {
  kind: AffordabilityKind;
  cost: ItemCost;
  resources: AbstractResourceLevel;
}

export type PurchaseMode = 'purchase' | 'gift';

export function isAbstractResourceLevel(value: unknown): value is AbstractResourceLevel {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    (ABSTRACT_RESOURCE_LEVELS as readonly number[]).includes(value)
  );
}

export function clampAbstractResourceLevel(value: number): AbstractResourceLevel {
  if (!Number.isFinite(value)) return DEFAULT_ABSTRACT_RESOURCE_LEVEL;
  const rounded = Math.round(value);
  if (rounded <= 0) return 0;
  if (rounded >= 5) return 5;
  return rounded as AbstractResourceLevel;
}

export function createDefaultAbstractResources(): CharacterAbstractResources {
  return { current: DEFAULT_ABSTRACT_RESOURCE_LEVEL };
}

/**
 * Parses JSONB / DTO bags into a typed resources object.
 * Accepts: bare number, `{ current }`, or `{ sagatreeAbstract: { current, base? } }`.
 */
export function parseCharacterAbstractResources(raw: unknown): CharacterAbstractResources {
  if (raw == null) return createDefaultAbstractResources();
  if (typeof raw === 'number') {
    return { current: clampAbstractResourceLevel(raw) };
  }
  if (typeof raw !== 'object') return createDefaultAbstractResources();

  const bag = raw as Record<string, unknown>;
  const nested = bag[RESOURCES_JSONB_KEY];
  const source =
    nested && typeof nested === 'object'
      ? (nested as Record<string, unknown>)
      : bag;

  const currentRaw = source.current ?? source.value ?? bag.current;
  const result: CharacterAbstractResources = {
    current: isAbstractResourceLevel(currentRaw)
      ? currentRaw
      : typeof currentRaw === 'number'
        ? clampAbstractResourceLevel(currentRaw)
        : DEFAULT_ABSTRACT_RESOURCE_LEVEL,
  };

  if ('base' in source && source.base !== undefined && source.base !== null) {
    result.base = isAbstractResourceLevel(source.base)
      ? source.base
      : typeof source.base === 'number'
        ? clampAbstractResourceLevel(source.base)
        : DEFAULT_ABSTRACT_RESOURCE_LEVEL;
  }

  return result;
}

/** Serializes into the `characters.resources` JSONB shape (merge-friendly). */
export function serializeCharacterAbstractResources(
  resources: CharacterAbstractResources,
  existing?: Record<string, unknown> | null,
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...(existing && typeof existing === 'object' ? existing : {}),
  };
  const payload: Record<string, AbstractResourceLevel> = {
    current: clampAbstractResourceLevel(resources.current),
  };
  if (resources.base !== undefined) {
    payload.base = clampAbstractResourceLevel(resources.base);
  }
  next[RESOURCES_JSONB_KEY] = payload;
  return next;
}

/**
 * Issue #32 affordability matrix (editor), aligned with §10.3 thresholds:
 * - cost < resources → add freely; resources unchanged
 * - cost === resources → choose purchase (−1) or gift
 * - cost > resources → blocked until gift/quest override
 */
export function resolveAffordability(
  cost: ItemCost | number,
  resources: AbstractResourceLevel | number,
): AffordabilityDecision {
  const safeCost: ItemCost = isItemCost(cost) ? cost : (clampAbstractResourceLevel(cost) as ItemCost);
  const safeResources = clampAbstractResourceLevel(resources);
  if (safeCost > safeResources) {
    return { kind: 'blocked-needs-gift-override', cost: safeCost, resources: safeResources };
  }
  if (safeCost === safeResources) {
    return { kind: 'require-purchase-choice', cost: safeCost, resources: safeResources };
  }
  return { kind: 'allow-free', cost: safeCost, resources: safeResources };
}

/**
 * Applies purchase vs gift after an affordability decision.
 * Gift never lowers resources. Purchase lowers by 1 only when cost === resources.
 */
export function applyPurchaseMode(
  resources: AbstractResourceLevel,
  mode: PurchaseMode,
  decision: AffordabilityDecision,
): AbstractResourceLevel {
  if (mode === 'gift') return clampAbstractResourceLevel(resources);
  if (decision.kind === 'require-purchase-choice' && mode === 'purchase') {
    return clampAbstractResourceLevel(resources - 1);
  }
  return clampAbstractResourceLevel(resources);
}

export type MeleeAttackAttribute = 'strength' | 'dexterity';

/**
 * §10.1 Finesse: melee attack may use Dexterity instead of Strength when the
 * trait is present. Without Finesse, Strength is required.
 */
export function resolveMeleeAttackAttribute(
  traits: readonly string[],
  preferDexterity = false,
): MeleeAttackAttribute {
  const hasFinesse = traits.some((trait) => trait.trim().toLowerCase() === 'finesse');
  if (hasFinesse && preferDexterity) return 'dexterity';
  return 'strength';
}

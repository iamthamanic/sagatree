/**
 * Derived NPC/creature presentation helpers using the power framework (#196/#198).
 * Location: src/domains/npc-creature/derived.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import {
  computeCompactStatblockBenchmarks,
  machtgradForLevel,
  machtgradLabelForLevel,
  type SagaTreeCompactStatblockBenchmarks,
  type SagaTreeMachtgrad,
} from '../rules/sagatree/npc-creature-power';
import type { NpcCreatureDefinition } from './definition';

export interface NpcCreatureDerivedPower {
  machtgrad: SagaTreeMachtgrad;
  machtgradLabel: string;
  benchmarks: SagaTreeCompactStatblockBenchmarks;
}

/** Effective display stats after applying optional Advanced overrides. */
export interface NpcCreatureEffectiveStats {
  recommended: SagaTreeCompactStatblockBenchmarks;
  health: number;
  defense: number;
  movementMeters: number;
  attributes: readonly [number, number, number, number, number, number];
  resistanceHigh: number;
  resistanceNormal: number;
  resistanceLow: number;
  healthOverridden: boolean;
  defenseOverridden: boolean;
  movementOverridden: boolean;
  attributesOverridden: boolean;
  resistancesOverridden: boolean;
}

/** Derive Machtgrad + compact benchmarks from a validated definition. */
export function deriveNpcCreaturePower(
  definition: NpcCreatureDefinition,
): NpcCreatureDerivedPower {
  const benchmarks = computeCompactStatblockBenchmarks({
    level: definition.level,
    combatProfile: definition.combatProfile,
    combatRole: definition.combatRole,
  });
  return {
    machtgrad: machtgradForLevel(definition.level),
    machtgradLabel: machtgradLabelForLevel(definition.level),
    benchmarks,
  };
}

/**
 * Merge optional `statOverrides` onto recommended benchmarks for live Statblock.
 * Does not clamp — callers must validate overrides before save.
 */
export function resolveNpcCreatureEffectiveStats(
  definition: NpcCreatureDefinition,
): NpcCreatureEffectiveStats {
  const { benchmarks: recommended } = deriveNpcCreaturePower(definition);
  const overrides = definition.statOverrides;
  const health = overrides?.health ?? recommended.health;
  const defense = overrides?.defense ?? recommended.defense;
  const movementMeters = overrides?.movementMeters ?? recommended.movementMeters;
  const attributes = overrides?.attributes ?? recommended.attributeDefaults;
  const resistanceHigh = overrides?.resistanceHigh ?? recommended.resistances.high;
  const resistanceNormal = overrides?.resistanceNormal ?? recommended.resistances.normal;
  const resistanceLow = overrides?.resistanceLow ?? recommended.resistances.low;

  return {
    recommended,
    health,
    defense,
    movementMeters,
    attributes,
    resistanceHigh,
    resistanceNormal,
    resistanceLow,
    healthOverridden: overrides?.health !== undefined,
    defenseOverridden: overrides?.defense !== undefined,
    movementOverridden: overrides?.movementMeters !== undefined,
    attributesOverridden: overrides?.attributes !== undefined,
    resistancesOverridden:
      overrides?.resistanceHigh !== undefined
      || overrides?.resistanceNormal !== undefined
      || overrides?.resistanceLow !== undefined,
  };
}

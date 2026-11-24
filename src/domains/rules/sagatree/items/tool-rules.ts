/**
 * sagatree tool rules — §5.7 Werkzeugsemantik as a pure check contract.
 * Location: src/domains/rules/sagatree/items/tool-rules.ts
 *
 * High-quality tools never invent a numeric bonus; advantage applies only when
 * an explicit rule defines it.
 *
 * Domain-pure: no React, no backend clients, no inventory state.
 */

/** How suitable the available tools are for the attempted action. */
export type ToolSuitability =
  | 'suitable'
  | 'incomplete'
  | 'improvised'
  | 'indispensable-missing'
  | 'high-quality';

/**
 * Check outcome implied by tool suitability.
 * `explicit-advantage-only` means high-quality tools grant advantage only when
 * another rule explicitly says so — never an automatic numeric bonus.
 */
export type ToolCheckOutcome = 'normal' | 'disadvantage' | 'impossible' | 'explicit-advantage-only';

export interface ToolCheckResolution {
  outcome: ToolCheckOutcome;
  /** Always false: tools do not invent numeric bonuses. */
  inventsNumericBonus: false;
}

/**
 * Resolves §5.7 tool suitability to a check outcome.
 * - suitable → normal
 * - incomplete / improvised → disadvantage
 * - indispensable-missing → impossible
 * - high-quality → explicit-advantage-only (no invented numbers)
 */
export function resolveToolCheckOutcome(suitability: ToolSuitability): ToolCheckResolution {
  switch (suitability) {
    case 'suitable':
      return { outcome: 'normal', inventsNumericBonus: false };
    case 'incomplete':
    case 'improvised':
      return { outcome: 'disadvantage', inventsNumericBonus: false };
    case 'indispensable-missing':
      return { outcome: 'impossible', inventsNumericBonus: false };
    case 'high-quality':
      return { outcome: 'explicit-advantage-only', inventsNumericBonus: false };
  }
}

/**
 * High-quality / quality traits must not auto-grant a numeric modifier.
 * Callers may only apply advantage when an explicit rule grants it.
 */
export function toolQualityInventedBonus(_qualityTrait: string | undefined): 0 {
  return 0;
}

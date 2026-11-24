/**
 * sagatree carry capacity — §6.7 / §10.2 / §10.0.1 Traglast formula.
 * Location: src/domains/rules/sagatree/items/carry-capacity.ts
 *
 * Single source of truth for `5 + 2 × Stärke`. Inventory v2 owns load *summing*
 * (`calculateTotalLoad`); this module owns the capacity ceiling. Consumers must
 * not copy the formula.
 *
 * Domain-pure: no React, no backend clients, no inventory state.
 */

/**
 * Maximum load points a character may carry without overload.
 * Formula: Traglast = 5 + (2 × Stärke).
 */
export function carryCapacity(strength: number): number {
  return 5 + 2 * strength;
}

/** True when total load exceeds Traglast (§10.2). */
export function isOverloaded(totalLoad: number, strength: number): boolean {
  return totalLoad > carryCapacity(strength);
}

/** True when total load exceeds twice Traglast (§10.2 — no normal sustained movement). */
export function exceedsDoubleCarryCapacity(totalLoad: number, strength: number): boolean {
  return totalLoad > 2 * carryCapacity(strength);
}

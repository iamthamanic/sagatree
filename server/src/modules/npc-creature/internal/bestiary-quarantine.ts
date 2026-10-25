/**
 * Quarantined bestiary encounter math (MIG-403 / #819).
 * Location: server/src/modules/npc-creature/internal/bestiary-quarantine.ts
 *
 * NOT a public host route. Legacy worker is dispatcher-unmounted (404).
 * These helpers exist only for isolated-contract fixtures characterizing
 * historical XP/multiplier behavior — including known unbounded defects.
 * Do not wire into HTTP/WS without a separate human activation ticket.
 */

/** Explicit product decision: no automatic host/public activation. */
export const BESTIARY_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

export type QuarantineMonster = {
  readonly id: string;
  readonly name: string;
  readonly challengeRating: number;
  readonly xp: number;
};

/**
 * Legacy encounter XP: sum only known monsters' xp*count for totalXP,
 * but multiplier uses the sum of *requested* counts (including unknown ids).
 * This mismatch is the documented legacy defect — preserved for fixtures.
 */
export function computeEncounterXp(input: {
  readonly catalog: ReadonlyMap<string, QuarantineMonster>;
  readonly monsters: ReadonlyArray<{ readonly monsterId: string; readonly count: number }>;
}): { readonly totalXP: number; readonly adjustedXP: number; readonly multiplier: number; readonly knownCount: number; readonly requestedCount: number } {
  let totalXP = 0;
  let knownCount = 0;
  for (const m of input.monsters) {
    const monster = input.catalog.get(m.monsterId);
    if (monster) {
      totalXP += monster.xp * m.count;
      knownCount += m.count;
    }
  }
  const requestedCount = input.monsters.reduce((sum, m) => sum + m.count, 0);
  let multiplier = 1;
  if (requestedCount === 2) multiplier = 1.5;
  else if (requestedCount >= 3 && requestedCount <= 6) multiplier = 2;
  else if (requestedCount >= 7 && requestedCount <= 10) multiplier = 2.5;
  else if (requestedCount >= 11 && requestedCount <= 14) multiplier = 3;
  else if (requestedCount >= 15) multiplier = 4;
  return {
    totalXP,
    adjustedXP: Math.floor(totalXP * multiplier),
    multiplier,
    knownCount,
    requestedCount,
  };
}

export function parseChallengeRating(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Defaults mirroring legacy createMonster falsy || fallbacks (characterization). */
export function applyMonsterDefaults(data: Record<string, unknown>): {
  readonly name: string;
  readonly type: string;
  readonly size: string;
  readonly challengeRating: number;
  readonly xp: number;
  readonly hp: number;
} {
  const cr = typeof data.challengeRating === 'number' ? data.challengeRating : 0;
  return {
    name: (typeof data.name === 'string' && data.name) || 'Unknown',
    type: (typeof data.type === 'string' && data.type) || 'beast',
    size: (typeof data.size === 'string' && data.size) || 'medium',
    challengeRating: cr || 0,
    xp: typeof data.xp === 'number' ? data.xp : cr * 10,
    hp: typeof data.hp === 'number' ? data.hp : 10,
  };
}

/** Isolated list/filter + search characterization (no persistence). */
export function filterMonsters(
  catalog: ReadonlyArray<QuarantineMonster & { readonly type: string; readonly size: string }>,
  query: { readonly type?: string; readonly cr?: number; readonly size?: string; readonly q?: string },
): ReadonlyArray<QuarantineMonster & { readonly type: string; readonly size: string }> {
  return catalog.filter((m) => {
    if (query.type && m.type !== query.type) return false;
    if (query.size && m.size !== query.size) return false;
    if (query.cr !== undefined && m.challengeRating !== query.cr) return false;
    if (query.q !== undefined && query.q !== '') {
      const needle = query.q.toLowerCase();
      if (!m.name.toLowerCase().includes(needle)) return false;
    }
    return true;
  });
}

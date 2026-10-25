/**
 * Quarantined bestiary encounter math (MIG-403 / #819).
 * Location: server/src/modules/npc-creature/internal/bestiary-quarantine.ts
 *
 * NOT a public host route. Legacy worker is dispatcher-unmounted (404).
 * These helpers characterize historical create/list/search/encounter behavior —
 * including known unbounded defects — for isolated-contract fixtures only.
 * Do not wire into HTTP/WS without a separate human activation ticket.
 */

/** Explicit product decision: no automatic host/public activation. */
export const BESTIARY_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

/** Legacy CR → XP table from supabase/functions/bestiary/index.ts calculateXP. */
const XP_TABLE: Readonly<Record<number, number>> = Object.freeze({
  0: 10,
  0.125: 25,
  0.25: 50,
  0.5: 100,
  1: 200,
  2: 450,
  3: 700,
  4: 1100,
  5: 1800,
  6: 2300,
  7: 2900,
  8: 3900,
  9: 5000,
  10: 5900,
  11: 7200,
  12: 8400,
  13: 10000,
  14: 11500,
  15: 13000,
  16: 15000,
  17: 18000,
  18: 20000,
  19: 22000,
  20: 25000,
  21: 33000,
  22: 41000,
  23: 50000,
  24: 62000,
  25: 75000,
  26: 90000,
  27: 105000,
  28: 120000,
  29: 135000,
  30: 155000,
});

export function calculateXp(cr: number): number {
  return XP_TABLE[cr] || 0;
}

export type QuarantineMonster = {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly size: string;
  readonly challengeRating: number;
  readonly xp: number;
  readonly hp: number;
  readonly hitDice: string;
  readonly ac: number;
  readonly speed: { readonly walk: number };
  readonly strength: number;
  readonly dexterity: number;
  readonly constitution: number;
  readonly intelligence: number;
  readonly wisdom: number;
  readonly charisma: number;
  readonly senses: ReadonlyArray<string>;
  readonly languages: ReadonlyArray<string>;
  readonly challengeRatingText: string;
  readonly actions: ReadonlyArray<unknown>;
  readonly source: string;
  readonly description?: string;
};

/**
 * Legacy encounter XP: sum only known monsters' xp*count for totalXP,
 * but multiplier uses the sum of *requested* counts (including unknown ids).
 * This mismatch is the documented legacy defect — preserved for fixtures.
 */
export function computeEncounterXp(input: {
  readonly catalog: ReadonlyMap<string, Pick<QuarantineMonster, 'id' | 'name' | 'challengeRating' | 'xp'>>;
  readonly monsters: ReadonlyArray<{ readonly monsterId: string; readonly count: number }>;
}): {
  readonly totalXP: number;
  readonly adjustedXP: number;
  readonly multiplier: number;
  readonly knownCount: number;
  readonly requestedCount: number;
} {
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

/**
 * Defaults mirroring legacy createMonster falsy || fallbacks (characterization).
 * Explicit 0 / '' / nullish fields take the || branch just like the Edge worker.
 */
export function applyMonsterDefaults(data: Record<string, unknown>): QuarantineMonster {
  const crRaw = data.challengeRating;
  const cr = (typeof crRaw === 'number' ? crRaw : 0) || 0;
  const speedIn = data.speed;
  const speed =
    speedIn && typeof speedIn === 'object' && 'walk' in (speedIn as object)
      ? { walk: Number((speedIn as { walk: unknown }).walk) || 30 }
      : { walk: 30 };
  return {
    id: typeof data.id === 'string' && data.id ? data.id : 'fixture',
    name: (typeof data.name === 'string' && data.name) || 'Unknown',
    type: (typeof data.type === 'string' && data.type) || 'beast',
    size: (typeof data.size === 'string' && data.size) || 'medium',
    challengeRating: cr,
    xp: (typeof data.xp === 'number' ? data.xp : 0) || calculateXp(cr),
    hp: (typeof data.hp === 'number' ? data.hp : 0) || 10,
    hitDice: (typeof data.hitDice === 'string' && data.hitDice) || '2d6',
    ac: (typeof data.ac === 'number' ? data.ac : 0) || 10,
    speed,
    strength: (typeof data.strength === 'number' ? data.strength : 0) || 10,
    dexterity: (typeof data.dexterity === 'number' ? data.dexterity : 0) || 10,
    constitution: (typeof data.constitution === 'number' ? data.constitution : 0) || 10,
    intelligence: (typeof data.intelligence === 'number' ? data.intelligence : 0) || 10,
    wisdom: (typeof data.wisdom === 'number' ? data.wisdom : 0) || 10,
    charisma: (typeof data.charisma === 'number' ? data.charisma : 0) || 10,
    senses:
      Array.isArray(data.senses) && data.senses.length > 0
        ? data.senses.map(String)
        : ['passive Perception 10'],
    languages: Array.isArray(data.languages) ? data.languages.map(String) : [],
    challengeRatingText:
      (typeof data.challengeRatingText === 'string' && data.challengeRatingText) || String(cr),
    actions: Array.isArray(data.actions) ? data.actions : [],
    source: (typeof data.source === 'string' && data.source) || 'custom',
    description: typeof data.description === 'string' ? data.description : undefined,
  };
}

/** Isolated list/filter characterization — type match is case-insensitive (legacy). */
export function filterMonsters(
  catalog: ReadonlyArray<QuarantineMonster>,
  query: { readonly type?: string; readonly cr?: number; readonly size?: string },
): ReadonlyArray<QuarantineMonster> {
  return catalog
    .filter((m) => {
      if (query.type && m.type.toLowerCase() !== query.type.toLowerCase()) return false;
      if (query.size && m.size !== query.size) return false;
      if (query.cr !== undefined && m.challengeRating !== query.cr) return false;
      return true;
    })
    .slice()
    .sort((a, b) => a.challengeRating - b.challengeRating);
}

/** Isolated search — name, type, and description (legacy searchMonsters). */
export function searchMonsters(
  catalog: ReadonlyArray<QuarantineMonster>,
  query: string,
): ReadonlyArray<QuarantineMonster> {
  const lowerQuery = query.toLowerCase();
  return catalog.filter(
    (m) =>
      m.name.toLowerCase().includes(lowerQuery) ||
      m.type.toLowerCase().includes(lowerQuery) ||
      (m.description !== undefined && m.description.toLowerCase().includes(lowerQuery)),
  );
}

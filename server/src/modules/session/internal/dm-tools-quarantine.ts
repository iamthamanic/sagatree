/**
 * Quarantined dm-tools Edge worker characterization (MIG-407 / #823).
 * Location: server/src/modules/session/internal/dm-tools-quarantine.ts
 *
 * NOT a public host route. Legacy worker is dispatcher-unmounted (404).
 * Seeded fixtures characterize dice/combat/log shapes including unbounded
 * dice-count and unauthenticated authority defects. Do not activate publicly.
 */

/** Explicit product decision: no automatic host/public activation. */
export const DM_TOOLS_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

/** REDIS_URL is read in legacy worker but never used for persistence. */
export const DM_TOOLS_REDIS_PROVIDES_PERSISTENCE = false as const;

export type DiceRollParsed = {
  readonly notation: string;
  readonly count: number;
  readonly sides: number;
  readonly modifier: number;
  readonly keepHighest?: number;
  readonly keepLowest?: number;
};

export type DiceResult = {
  readonly notation: string;
  readonly rolls: ReadonlyArray<number>;
  readonly modifier: number;
  readonly advantage?: 'adv' | 'dis';
  readonly total: number;
  readonly criticalHit: boolean;
  readonly criticalFail: boolean;
  readonly details: string;
};

export type CombatParticipant = {
  readonly id: string;
  readonly name: string;
  hp: number;
  readonly maxHp: number;
  readonly initiativeBonus?: number;
  initiative: number;
  conditions: string[];
};

export type CombatLogEntry = {
  readonly type: string;
  readonly timestamp: string;
  readonly round: number;
  readonly turn?: number;
  readonly actor?: string;
  readonly participants?: ReadonlyArray<{ readonly id: string; readonly name: string; readonly initiative: number }>;
};

export type CombatState = {
  readonly id: string;
  readonly sessionId: string;
  round: number;
  currentTurn: number;
  participants: CombatParticipant[];
  log: CombatLogEntry[];
  status: 'active' | 'ended';
  readonly startedAt: string;
  endedAt?: string;
};

export type Rng = () => number;

/** Deterministic RNG for seeded fixtures (mulberry32). */
export function createSeededRng(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseDiceNotation(notation: string): DiceRollParsed {
  const match = notation.match(/^(\d+)?d(\d+)([+-]\d+)?(kh(\d+))?(kl(\d+))?$/i);
  if (!match) {
    throw new Error(`Invalid dice notation: ${notation}`);
  }
  return {
    notation,
    count: Number.parseInt(match[1] ?? '', 10) || 1,
    sides: Number.parseInt(match[2] ?? '', 10),
    modifier: Number.parseInt(match[3] ?? '', 10) || 0,
    keepHighest: match[5] ? Number.parseInt(match[5], 10) : undefined,
    keepLowest: match[7] ? Number.parseInt(match[7], 10) : undefined,
  };
}

function rollSingle(sides: number, rng: Rng): number {
  return Math.floor(rng() * sides) + 1;
}

/**
 * Legacy rollDice — count is unbounded (no max). Inject rng for fixtures.
 * Notation modifier is in parse; call-site modifier is additive (legacy).
 */
export function rollDice(
  notation: string,
  modifier: number = 0,
  advantage: 'adv' | 'dis' | null = null,
  rng: Rng = Math.random,
): DiceResult {
  const dice = parseDiceNotation(notation);
  let rolls: number[];
  if (dice.sides === 20 && advantage) {
    const roll1 = rollSingle(dice.sides, rng);
    const roll2 = rollSingle(dice.sides, rng);
    rolls = advantage === 'adv' ? [Math.max(roll1, roll2)] : [Math.min(roll1, roll2)];
  } else if (dice.keepHighest || dice.keepLowest) {
    const allRolls = Array.from({ length: dice.count }, () => rollSingle(dice.sides, rng));
    if (dice.keepHighest) {
      rolls = allRolls.sort((a, b) => b - a).slice(0, dice.keepHighest);
    } else {
      rolls = allRolls.sort((a, b) => a - b).slice(0, dice.keepLowest as number);
    }
  } else {
    rolls = Array.from({ length: dice.count }, () => rollSingle(dice.sides, rng));
  }
  const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier;
  const criticalHit = dice.sides === 20 && rolls[0] === 20;
  const criticalFail = dice.sides === 20 && rolls[0] === 1;
  const details = `${rolls.join(' + ')}${modifier !== 0 ? ` ${modifier >= 0 ? '+' : ''} ${modifier}` : ''} = ${total}`;
  return {
    notation,
    rolls,
    modifier,
    advantage: advantage || undefined,
    total,
    criticalHit,
    criticalFail,
    details,
  };
}

export function initCombat(
  sessionId: string,
  participants: ReadonlyArray<Omit<CombatParticipant, 'initiative'>>,
  rng: Rng,
  nowIso: string,
  combatId: string,
): CombatState {
  const participantsWithInitiative = participants
    .map((p) => ({
      ...p,
      initiative: rollDice('d20', 0, null, rng).total + (p.initiativeBonus || 0),
      conditions: p.conditions || [],
    }))
    .sort((a, b) => b.initiative - a.initiative);
  return {
    id: combatId,
    sessionId,
    round: 1,
    currentTurn: 0,
    participants: participantsWithInitiative,
    log: [
      {
        type: 'combat_start',
        timestamp: nowIso,
        round: 1,
        participants: participantsWithInitiative.map((p) => ({
          id: p.id,
          name: p.name,
          initiative: p.initiative,
        })),
      },
    ],
    status: 'active',
    startedAt: nowIso,
  };
}

export function nextTurn(combat: CombatState, nowIso: string): CombatState {
  const next = { ...combat, participants: combat.participants.map((p) => ({ ...p, conditions: [...p.conditions] })), log: [...combat.log] };
  next.currentTurn = (next.currentTurn + 1) % next.participants.length;
  if (next.currentTurn === 0) {
    next.round += 1;
    next.log.push({ type: 'round_start', timestamp: nowIso, round: next.round });
  }
  const nextParticipant = next.participants[next.currentTurn];
  next.log.push({
    type: 'turn_start',
    timestamp: nowIso,
    round: next.round,
    turn: next.currentTurn,
    actor: nextParticipant?.name,
  });
  return next;
}

export function endCombat(combat: CombatState, nowIso: string): CombatState {
  return {
    ...combat,
    status: 'ended',
    endedAt: nowIso,
    log: [
      ...combat.log,
      { type: 'combat_end', timestamp: nowIso, round: combat.round },
    ],
  };
}

export function applyDamage(
  combat: CombatState,
  targetId: string,
  damage: number,
  nowIso: string,
): CombatState {
  const next = {
    ...combat,
    participants: combat.participants.map((p) => ({ ...p, conditions: [...p.conditions] })),
    log: [...combat.log],
  };
  const target = next.participants.find((p) => p.id === targetId);
  if (!target) throw new Error('Target not found in combat');
  target.hp = Math.max(0, target.hp - damage);
  next.log.push({
    type: 'damage',
    timestamp: nowIso,
    round: next.round,
    turn: next.currentTurn,
  });
  return next;
}

/** Client-supplied session/character authority — no authentication in legacy worker. */
export function acceptUnauthenticatedCombatAuthority(input: {
  readonly sessionId: string;
  readonly characterId: string;
}): { readonly sessionId: string; readonly characterId: string; readonly authenticated: false } {
  return { sessionId: input.sessionId, characterId: input.characterId, authenticated: false };
}

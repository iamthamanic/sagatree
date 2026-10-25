/**
 * Quarantined characters Edge worker characterization (MIG-406 / #822).
 * Location: server/src/modules/character/internal/characters-quarantine.ts
 *
 * NOT a public host route. Legacy worker is dispatcher-unmounted (404).
 * Helpers characterize historical update/level-up/XP defects for isolated
 * fixtures only. Do not wire into HTTP/WS without a separate human activation.
 */

/** Explicit product decision: no automatic host/public activation. */
export const CHARACTERS_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

export type QuarantineCharacter = {
  readonly id: string;
  ownerId: string;
  readonly name: string;
  level: number;
  experience: number;
  proficiencyBonus: number;
  updatedAt: string;
};

const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000,
  140000, 165000, 195000, 225000, 265000, 305000, 355000,
] as const;

export function getXpThreshold(level: number): number {
  return XP_THRESHOLDS[level - 1] || 0;
}

export function calculateProficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

/**
 * Legacy updateCharacter: shallow spread permits client-supplied ownerId.
 * Path id is forced; updatedAt refreshed. This is NOT a successor auth rule.
 */
export function applyCharacterUpdate(
  existing: QuarantineCharacter,
  data: Partial<QuarantineCharacter>,
  pathId: string,
  nowIso: string,
): QuarantineCharacter {
  return {
    ...existing,
    ...data,
    id: pathId,
    updatedAt: nowIso,
  };
}

/**
 * Legacy levelUp resolves the character from BODY.characterId, not the path id.
 * Documented defect — neither path nor body becomes a successor authorization rule.
 */
export function resolveLevelUpTargetId(pathId: string, body: { readonly characterId?: string }): string {
  void pathId;
  if (typeof body.characterId === 'string' && body.characterId) return body.characterId;
  throw new Error('Character not found');
}

/**
 * Static characterization of the non-advancing addExperience while-loop:
 * `const nextLevel` / `const nextThreshold` never advance inside the loop, so when
 * experience >= threshold the condition stays true indefinitely.
 */
export function describeNonAdvancingXpLoopDefect(): {
  readonly nextLevelAdvances: false;
  readonly nextThresholdAdvances: false;
  readonly canLoopIndefinitelyAtThreshold: true;
} {
  return {
    nextLevelAdvances: false,
    nextThresholdAdvances: false,
    canLoopIndefinitelyAtThreshold: true,
  };
}

/**
 * Mirrors legacy addExperience control flow (including the hang).
 * Callers MUST supply a hard timeout / maxIterations — never run unbounded.
 */
export function addExperienceLegacyUnsafe(
  character: QuarantineCharacter,
  xp: number,
  options: { readonly maxIterations: number },
): { readonly character: QuarantineCharacter; readonly leveledUp: boolean; readonly stoppedByGuard: boolean } {
  const next = { ...character, experience: character.experience + xp };
  const nextLevel = next.level + 1;
  const nextThreshold = getXpThreshold(nextLevel);
  let leveledUp = false;
  let iterations = 0;
  let stoppedByGuard = false;
  while (next.experience >= nextThreshold && nextLevel <= 20) {
    iterations += 1;
    if (iterations > options.maxIterations) {
      stoppedByGuard = true;
      break;
    }
    next.level = nextLevel;
    next.proficiencyBonus = calculateProficiencyBonus(next.level);
    leveledUp = true;
    // BUG (legacy): nextLevel / nextThreshold are const and never advance.
  }
  next.updatedAt = character.updatedAt;
  return { character: next, leveledUp, stoppedByGuard };
}

/** Client-supplied ownerId on create — no authentication in historical worker. */
export function createCharacterRecord(input: {
  readonly ownerId: string;
  readonly name: string;
  readonly id: string;
  readonly nowIso: string;
}): QuarantineCharacter {
  return {
    id: input.id,
    ownerId: input.ownerId,
    name: input.name,
    level: 1,
    experience: 0,
    proficiencyBonus: 2,
    updatedAt: input.nowIso,
  };
}

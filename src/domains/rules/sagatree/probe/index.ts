/**
 * probe — SagaTree core check resolution (§2.2 / §2.5 / §2.10) for the rules kernel.
 * Location: src/domains/rules/sagatree/probe/index.ts
 * Hides: d20 mode folding, critical margins, Drive keep-better comparison.
 * Never imports React or backend clients.
 */

export const PROBE_CRITICAL_MARGIN = 10;
export const PROBE_SAFETY_BASE = 10;

export const PROBE_GRADES = Object.freeze({
  CRIT_SUCCESS: 'crit-success',
  SUCCESS: 'success',
  FAILURE: 'failure',
  CRIT_FAILURE: 'crit-failure',
} as const);

export type ProbeGrade = (typeof PROBE_GRADES)[keyof typeof PROBE_GRADES];

export type ProbeMode = 'normal' | 'advantage' | 'disadvantage' | 'safety';

export interface ProbeProfile {
  attribute: number;
  skill: number;
  experienceBonus: number;
  specialization?: number;
}

export interface ProbeOutcome {
  natural: number | null;
  naturals: readonly number[];
  flatBonus: number;
  total: number;
  grade: ProbeGrade;
  mode: ProbeMode;
}

const GRADE_RANK: Record<ProbeGrade, number> = {
  'crit-failure': 0,
  failure: 1,
  success: 2,
  'crit-success': 3,
};

export function isProbeMode(value: string): value is ProbeMode {
  return value === 'normal' || value === 'advantage' || value === 'disadvantage' || value === 'safety';
}

export function isProbeGrade(value: string): value is ProbeGrade {
  return (
    value === PROBE_GRADES.CRIT_SUCCESS ||
    value === PROBE_GRADES.SUCCESS ||
    value === PROBE_GRADES.FAILURE ||
    value === PROBE_GRADES.CRIT_FAILURE
  );
}

export function probeFlatBonus(profile: ProbeProfile): number {
  const specialization = profile.specialization ?? 0;
  return profile.attribute + profile.skill + profile.experienceBonus + specialization;
}

/**
 * §2.2 grade from total vs target, then natural 1/20 one-step shift (clamped).
 */
export function resolveProbeGrade(
  total: number,
  target: number,
  natural: number | null,
): ProbeGrade {
  const margin = total - target;
  let grade: ProbeGrade;
  if (margin >= PROBE_CRITICAL_MARGIN) grade = PROBE_GRADES.CRIT_SUCCESS;
  else if (margin >= 0) grade = PROBE_GRADES.SUCCESS;
  else if (margin <= -PROBE_CRITICAL_MARGIN) grade = PROBE_GRADES.CRIT_FAILURE;
  else grade = PROBE_GRADES.FAILURE;

  if (natural === 20 && grade !== PROBE_GRADES.CRIT_SUCCESS) {
    if (grade === PROBE_GRADES.CRIT_FAILURE) grade = PROBE_GRADES.FAILURE;
    else if (grade === PROBE_GRADES.FAILURE) grade = PROBE_GRADES.SUCCESS;
    else grade = PROBE_GRADES.CRIT_SUCCESS;
  } else if (natural === 1 && grade !== PROBE_GRADES.CRIT_FAILURE) {
    if (grade === PROBE_GRADES.CRIT_SUCCESS) grade = PROBE_GRADES.SUCCESS;
    else if (grade === PROBE_GRADES.SUCCESS) grade = PROBE_GRADES.FAILURE;
    else grade = PROBE_GRADES.CRIT_FAILURE;
  }
  return grade;
}

function keepNatural(mode: 'advantage' | 'disadvantage', a: number, b: number): number {
  return mode === 'advantage' ? Math.max(a, b) : Math.min(a, b);
}

/**
 * Resolve one probe from already-rolled naturals (server or test injects dice).
 * `mode: safety` ignores dice and uses §2.4 baseline 10 + bonuses (trained only).
 */
export function resolveProbeFromDice(input: {
  profile: ProbeProfile;
  target: number;
  mode: ProbeMode;
  naturals: readonly number[];
  trained?: boolean;
}): ProbeOutcome {
  const flatBonus = probeFlatBonus(input.profile);
  const mode = input.mode;

  if (mode === 'safety') {
    if (input.trained === false || input.profile.skill <= 0) {
      throw new Error('Sicheres Arbeiten erfordert eine trainierte Fertigkeit (§2.4).');
    }
    const total = PROBE_SAFETY_BASE + flatBonus;
    return {
      natural: null,
      naturals: [],
      flatBonus,
      total,
      grade: resolveProbeGrade(total, input.target, null),
      mode,
    };
  }

  if (mode === 'normal') {
    const natural = input.naturals[0];
    if (typeof natural !== 'number' || natural < 1 || natural > 20) {
      throw new Error('Normaler Check benötigt genau einen gültigen W20.');
    }
    const total = natural + flatBonus;
    return {
      natural,
      naturals: [natural],
      flatBonus,
      total,
      grade: resolveProbeGrade(total, input.target, natural),
      mode,
    };
  }

  const a = input.naturals[0];
  const b = input.naturals[1];
  if (
    typeof a !== 'number' ||
    typeof b !== 'number' ||
    a < 1 ||
    a > 20 ||
    b < 1 ||
    b > 20
  ) {
    throw new Error('Vorteil/Nachteil benötigt genau zwei gültige W20.');
  }
  const natural = keepNatural(mode, a, b);
  const total = natural + flatBonus;
  return {
    natural,
    naturals: [a, b],
    flatBonus,
    total,
    grade: resolveProbeGrade(total, input.target, natural),
    mode,
  };
}

/**
 * §2.10: keep the better outcome (higher grade; ties prefer higher total).
 */
export function pickBetterProbeOutcome(first: ProbeOutcome, second: ProbeOutcome): ProbeOutcome {
  const rankDiff = GRADE_RANK[second.grade] - GRADE_RANK[first.grade];
  if (rankDiff > 0) return second;
  if (rankDiff < 0) return first;
  if (second.total > first.total) return second;
  if (second.total < first.total) return first;
  return first;
}

export function applyDriveReroll(input: {
  first: ProbeOutcome;
  reroll: ProbeOutcome;
  driveAvailable: number;
}): { kept: ProbeOutcome; driveSpent: 1; driveRemaining: number } {
  if (input.driveAvailable < 1) {
    throw new Error('Kein Drive verfügbar für Reroll (§2.10).');
  }
  return {
    kept: pickBetterProbeOutcome(input.first, input.reroll),
    driveSpent: 1,
    driveRemaining: input.driveAvailable - 1,
  };
}

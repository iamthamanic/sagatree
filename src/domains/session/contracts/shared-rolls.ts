/**
 * shared-rolls — Session roll command inputs + lastRoll projection (#299).
 * Location: src/domains/session/contracts/shared-rolls.ts
 * Hides: which payload keys clients may send vs server-owned result fields.
 * Never imports React or backend clients.
 */
import {
  isProbeGrade,
  isProbeMode,
  type ProbeGrade,
  type ProbeMode,
  type ProbeOutcome,
} from '../../rules/sagatree/probe';
import { isSagaTreeSkillKey, type SagaTreeSkillKey } from '../../rules/sagatree/character-creation';

/** Client-forged result keys — server must strip before resolve. */
export const FORGED_ROLL_RESULT_KEYS = [
  'total',
  'grade',
  'natural',
  'naturals',
  'dice',
  'result',
  'outcome',
  'keptNatural',
  'flatBonus',
  'attributeValue',
  'skillRank',
  'experienceBonus',
  'driveSpent',
  'driveRemaining',
  'authoritative',
] as const;

export type RollMode = Exclude<ProbeMode, 'safety'>;

export interface SharedRollCommandInput {
  skill: SagaTreeSkillKey;
  characterPublicId: string | null;
  characterId: string | null;
  mode: RollMode;
  useDrive: boolean;
  /** GM may publish; players' values are ignored server-side. */
  target: number | null;
  resistance: number | null;
  intent: 'standard-check';
}

export interface SharedRollResultView {
  skill: string;
  mode: RollMode;
  target: number;
  natural: number | null;
  naturals: readonly number[];
  flatBonus: number;
  total: number;
  grade: ProbeGrade;
  useDrive: boolean;
  driveSpent: number;
  characterPublicId: string | null;
  actorUserId: string | null;
  authoritative: true;
}

export function isRollMode(value: string): value is RollMode {
  return value === 'normal' || value === 'advantage' || value === 'disadvantage';
}

export function stripForgedRollResultKeys(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...payload };
  for (const key of FORGED_ROLL_RESULT_KEYS) {
    delete next[key];
  }
  return next;
}

export function parseSharedRollCommandInput(
  payload: Record<string, unknown>,
): SharedRollCommandInput {
  const sanitized = stripForgedRollResultKeys(payload);
  const skillRaw = sanitized.skill;
  if (typeof skillRaw !== 'string' || !isSagaTreeSkillKey(skillRaw)) {
    throw new Error('Ungültige Fertigkeit für Session-Check.');
  }
  const modeRaw = typeof sanitized.mode === 'string' ? sanitized.mode : 'normal';
  if (!isRollMode(modeRaw)) {
    throw new Error('Ungültiger Check-Modus (normal/advantage/disadvantage).');
  }
  const target =
    typeof sanitized.target === 'number' && Number.isFinite(sanitized.target)
      ? Math.round(sanitized.target)
      : null;
  const resistance =
    typeof sanitized.resistance === 'number' && Number.isFinite(sanitized.resistance)
      ? Math.round(sanitized.resistance)
      : null;

  return {
    skill: skillRaw,
    characterPublicId:
      typeof sanitized.characterPublicId === 'string' ? sanitized.characterPublicId : null,
    characterId: typeof sanitized.characterId === 'string' ? sanitized.characterId : null,
    mode: modeRaw,
    useDrive: sanitized.useDrive === true,
    target,
    resistance,
    intent: 'standard-check',
  };
}

export function buildSharedRollResultView(input: {
  skill: string;
  mode: RollMode;
  target: number;
  outcome: ProbeOutcome;
  useDrive: boolean;
  driveSpent: number;
  characterPublicId: string | null;
  actorUserId: string | null;
}): SharedRollResultView {
  return {
    skill: input.skill,
    mode: input.mode,
    target: input.target,
    natural: input.outcome.natural,
    naturals: input.outcome.naturals,
    flatBonus: input.outcome.flatBonus,
    total: input.outcome.total,
    grade: input.outcome.grade,
    useDrive: input.useDrive,
    driveSpent: input.driveSpent,
    characterPublicId: input.characterPublicId,
    actorUserId: input.actorUserId,
    authoritative: true,
  };
}

export function readLastSharedRoll(shared: Record<string, unknown>): SharedRollResultView | null {
  const raw = shared.lastRoll;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (row.authoritative !== true) return null;
  const mode = typeof row.mode === 'string' && isRollMode(row.mode) ? row.mode : null;
  const grade = typeof row.grade === 'string' && isProbeGrade(row.grade) ? row.grade : null;
  if (!mode || !grade) return null;
  if (typeof row.skill !== 'string' || typeof row.total !== 'number' || typeof row.target !== 'number') {
    return null;
  }
  const naturals = Array.isArray(row.naturals)
    ? row.naturals.filter((n): n is number => typeof n === 'number')
    : [];
  return {
    skill: row.skill,
    mode,
    target: row.target,
    natural: typeof row.natural === 'number' ? row.natural : null,
    naturals,
    flatBonus: typeof row.flatBonus === 'number' ? row.flatBonus : 0,
    total: row.total,
    grade,
    useDrive: row.useDrive === true,
    driveSpent: typeof row.driveSpent === 'number' ? row.driveSpent : 0,
    characterPublicId: typeof row.characterPublicId === 'string' ? row.characterPublicId : null,
    actorUserId: typeof row.actorUserId === 'string' ? row.actorUserId : null,
    authoritative: true,
  };
}

export function assertNoForgedRollResults(payload: Record<string, unknown>): void {
  for (const key of FORGED_ROLL_RESULT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      throw new Error(`Client darf Check-Ergebnisfeld nicht senden: ${key}`);
    }
  }
}

export function isProbeModeAllowedForSession(value: string): value is RollMode {
  return isProbeMode(value) && value !== 'safety';
}

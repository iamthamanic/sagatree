/**
 * session-death-lifecycle — Authoritative alive→downed→stable→dead track (#373).
 * Location: src/domains/session/contracts/session-death-lifecycle.ts
 *
 * SagaTree Core Rules §8.5 / §16.4. Pure domain; no React/backend clients.
 * Does not duplicate damage math — only life-state transitions after HP changes.
 */
import type { LiveSessionAccess } from './live-session-access';
import { canExecuteLiveSessionCommand } from './live-session-access';

export const LIFE_SCHEMA_VERSION = 1 as const;

export type LifeStatus = 'alive' | 'downed' | 'stable' | 'dead';

export type LifeDifficulty = 'Heroisch' | 'Standard' | 'Hart';

/** Death-save outcome grades (§8.5). */
export type DeathSaveGrade =
  | 'crit_success'
  | 'success'
  | 'failure'
  | 'crit_failure';

export type CharacterLifeState = {
  readonly schemaVersion: typeof LIFE_SCHEMA_VERSION;
  readonly status: LifeStatus;
  /** Sterbend 0–3; 3 means dead (status dead). */
  readonly dyingLevel: number;
  readonly wounds: number;
  readonly difficulty: LifeDifficulty;
  readonly updatedAt: string | null;
};

export type DeathLifecycleOp =
  | 'enter_downed'
  | 'death_save'
  | 'stabilize'
  | 'mark_dead'
  | 'clear_alive'
  | 'set_difficulty';

export type DeathLifecycleCommand = {
  readonly op: DeathLifecycleOp;
  readonly characterId: string;
  readonly participantId?: string | null;
  readonly grade?: DeathSaveGrade | null;
  readonly difficulty?: LifeDifficulty | null;
  readonly explicitDeadly?: boolean | null;
  readonly confirmDead?: boolean | null;
  readonly note?: string | null;
};

export type DeathLifecycleApplyResult =
  | {
      readonly ok: true;
      readonly life: CharacterLifeState;
      readonly conditions: readonly string[];
      readonly eventPayload: Record<string, unknown>;
    }
  | { readonly ok: false; readonly reason: string };

const DIFFICULTIES: readonly LifeDifficulty[] = ['Heroisch', 'Standard', 'Hart'];
const GRADES: readonly DeathSaveGrade[] = [
  'crit_success',
  'success',
  'failure',
  'crit_failure',
];

export function emptyLifeState(difficulty: LifeDifficulty = 'Standard'): CharacterLifeState {
  return {
    schemaVersion: LIFE_SCHEMA_VERSION,
    status: 'alive',
    dyingLevel: 0,
    wounds: 0,
    difficulty,
    updatedAt: null,
  };
}

export function isLifeDifficulty(value: string): value is LifeDifficulty {
  return (DIFFICULTIES as readonly string[]).includes(value);
}

export function isDeathSaveGrade(value: string): value is DeathSaveGrade {
  return (GRADES as readonly string[]).includes(value);
}

/** §16.4 start dying level when dropping to 0 HP. */
export function difficultyStartDyingLevel(
  difficulty: LifeDifficulty,
  opts?: { explicitDeadly?: boolean; isCritical?: boolean },
): number {
  if (difficulty === 'Heroisch') {
    if (opts?.explicitDeadly === true || opts?.isCritical === true) return 1;
    return 0; // stable at 0 unless deadly/crit
  }
  if (difficulty === 'Hart') return 2;
  return 1;
}

export function parseCharacterLifeState(raw: unknown): CharacterLifeState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const status = row.status;
  if (
    status !== 'alive'
    && status !== 'downed'
    && status !== 'stable'
    && status !== 'dead'
  ) {
    return null;
  }
  const difficulty =
    typeof row.difficulty === 'string' && isLifeDifficulty(row.difficulty)
      ? row.difficulty
      : 'Standard';
  const dyingLevel =
    typeof row.dyingLevel === 'number' && Number.isFinite(row.dyingLevel)
      ? Math.max(0, Math.min(3, Math.floor(row.dyingLevel)))
      : 0;
  const wounds =
    typeof row.wounds === 'number' && Number.isFinite(row.wounds)
      ? Math.max(0, Math.min(3, Math.floor(row.wounds)))
      : 0;
  return {
    schemaVersion: LIFE_SCHEMA_VERSION,
    status,
    dyingLevel: status === 'dead' ? 3 : dyingLevel,
    wounds,
    difficulty,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : null,
  };
}

/** Read `shared.lifeByCharacter[characterId]`. */
export function readLifeByCharacter(
  shared: Record<string, unknown>,
  characterId: string,
): CharacterLifeState | null {
  const id = characterId.trim();
  if (!id) return null;
  const map = shared.lifeByCharacter;
  if (!map || typeof map !== 'object' || Array.isArray(map)) return null;
  return parseCharacterLifeState((map as Record<string, unknown>)[id]);
}

export function readSessionLifeDifficulty(shared: Record<string, unknown>): LifeDifficulty {
  const raw = shared.lifeDifficulty;
  if (typeof raw === 'string' && isLifeDifficulty(raw)) return raw;
  return 'Standard';
}

/**
 * Project presentation conditions from life state.
 * Keeps `bewusstlos` on downed for #300 combat compatibility; adds `kampfunfähig` / `tot`.
 */
export function conditionsFromLife(life: CharacterLifeState): string[] {
  if (life.status === 'dead') return ['tot', 'kampfunfähig'];
  if (life.status === 'stable') {
    return life.dyingLevel === 0
      ? ['kampfunfähig', 'stabil']
      : ['kampfunfähig', 'stabil', `sterbend:${life.dyingLevel}`];
  }
  if (life.status === 'downed') {
    const tags = ['kampfunfähig', 'bewusstlos'];
    if (life.dyingLevel > 0) tags.push(`sterbend:${life.dyingLevel}`);
    return tags;
  }
  return [];
}

export function canPerformProhibitedGameplay(life: CharacterLifeState | null): boolean {
  if (!life) return true;
  return life.status === 'alive';
}

export function lifeStatusLabel(life: CharacterLifeState): string {
  if (life.status === 'dead') return 'Tot';
  if (life.status === 'stable') return 'Stabil (0 TP)';
  if (life.status === 'downed') {
    return life.dyingLevel > 0 ? `Sterbend ${life.dyingLevel}` : 'Kampfunfähig';
  }
  return 'Lebend';
}

export function parseDeathLifecycleCommand(raw: unknown): DeathLifecycleCommand {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Ungültiger Life-Command');
  }
  const row = raw as Record<string, unknown>;
  const op = row.op;
  const allowed: DeathLifecycleOp[] = [
    'enter_downed',
    'death_save',
    'stabilize',
    'mark_dead',
    'clear_alive',
    'set_difficulty',
  ];
  if (typeof op !== 'string' || !allowed.includes(op as DeathLifecycleOp)) {
    throw new Error('Ungültige Life-Operation');
  }
  const characterId = typeof row.characterId === 'string' ? row.characterId.trim() : '';
  if (!characterId && op !== 'set_difficulty') {
    throw new Error('characterId erforderlich');
  }
  let grade: DeathSaveGrade | null = null;
  if (typeof row.grade === 'string' && isDeathSaveGrade(row.grade)) {
    grade = row.grade;
  }
  let difficulty: LifeDifficulty | null = null;
  if (typeof row.difficulty === 'string' && isLifeDifficulty(row.difficulty)) {
    difficulty = row.difficulty;
  }
  return {
    op: op as DeathLifecycleOp,
    characterId,
    participantId: typeof row.participantId === 'string' ? row.participantId.trim() : null,
    grade,
    difficulty,
    explicitDeadly: row.explicitDeadly === true,
    confirmDead: row.confirmDead === true,
    note: typeof row.note === 'string' ? row.note : null,
  };
}

export function assertDeathLifecycleAccess(
  access: LiveSessionAccess,
  _command: DeathLifecycleCommand,
): void {
  if (access.role !== 'gamemaster') {
    throw new Error('Nur Spielleiter darf Life-State ändern');
  }
  if (!canExecuteLiveSessionCommand(access, 'gameplay_mutate')) {
    throw new Error('Keine Gameplay-Rechte');
  }
}

function stamp(life: Omit<CharacterLifeState, 'updatedAt'>): CharacterLifeState {
  return { ...life, updatedAt: new Date().toISOString() };
}

/** Apply one death-save grade to a downed character (§8.5). */
export function applyDeathSaveGrade(
  life: CharacterLifeState,
  grade: DeathSaveGrade,
): CharacterLifeState {
  if (life.status === 'dead') return life;
  if (life.status !== 'downed' && life.status !== 'stable') {
    return life;
  }
  let level = life.dyingLevel;
  if (life.status === 'stable' && level === 0) {
    // already stable — death save only if forced into dying again
    return life;
  }
  switch (grade) {
    case 'crit_success':
      return stamp({
        ...life,
        status: 'stable',
        dyingLevel: 0,
      });
    case 'success':
      level = Math.max(0, level - 1);
      return stamp({
        ...life,
        status: level === 0 ? 'stable' : 'downed',
        dyingLevel: level,
      });
    case 'failure':
      level = level + 1;
      break;
    case 'crit_failure':
      level = level + 2;
      break;
  }
  if (level >= 3) {
    return stamp({ ...life, status: 'dead', dyingLevel: 3 });
  }
  return stamp({ ...life, status: 'downed', dyingLevel: level });
}

/**
 * Enter downed/stable from a drop to 0 HP.
 * Hart: track wounds; after 3 wounds further drops raise dying.
 */
export function enterDownedFromZeroHp(
  previous: CharacterLifeState | null,
  difficulty: LifeDifficulty,
  opts?: { explicitDeadly?: boolean; isCritical?: boolean },
): CharacterLifeState {
  const base = previous ?? emptyLifeState(difficulty);
  if (base.status === 'dead') return base;

  let wounds = base.wounds;
  let start = difficultyStartDyingLevel(difficulty, opts);

  if (difficulty === 'Hart') {
    if (wounds < 3) {
      wounds += 1;
    } else {
      start = Math.min(3, start + 1);
    }
  }

  if (difficulty === 'Heroisch' && start === 0) {
    return stamp({
      schemaVersion: LIFE_SCHEMA_VERSION,
      status: 'stable',
      dyingLevel: 0,
      wounds,
      difficulty,
    });
  }

  if (start >= 3) {
    return stamp({
      schemaVersion: LIFE_SCHEMA_VERSION,
      status: 'dead',
      dyingLevel: 3,
      wounds,
      difficulty,
    });
  }

  return stamp({
    schemaVersion: LIFE_SCHEMA_VERSION,
    status: start === 0 ? 'stable' : 'downed',
    dyingLevel: start,
    wounds,
    difficulty,
  });
}

/** Heal above 0 HP clears dying track (inventory untouched). */
export function clearAliveFromHeal(
  previous: CharacterLifeState | null,
  difficulty: LifeDifficulty,
): CharacterLifeState {
  const base = previous ?? emptyLifeState(difficulty);
  if (base.status === 'dead') {
    // Dead stays dead until explicit GM clear/revive
    return base;
  }
  return stamp({
    schemaVersion: LIFE_SCHEMA_VERSION,
    status: 'alive',
    dyingLevel: 0,
    wounds: base.wounds,
    difficulty: base.difficulty,
  });
}

export function applyDeathLifecycleCommand(input: {
  command: DeathLifecycleCommand;
  previous: CharacterLifeState | null;
  sessionDifficulty: LifeDifficulty;
}): DeathLifecycleApplyResult {
  const { command } = input;
  const difficulty = command.difficulty ?? input.sessionDifficulty;
  const prev = input.previous ?? emptyLifeState(difficulty);

  switch (command.op) {
    case 'set_difficulty': {
      if (!command.difficulty) {
        return { ok: false, reason: 'difficulty erforderlich' };
      }
      const life = stamp({ ...prev, difficulty: command.difficulty });
      return {
        ok: true,
        life,
        conditions: conditionsFromLife(life),
        eventPayload: {
          op: 'set_difficulty',
          characterId: command.characterId || null,
          difficulty: command.difficulty,
          authoritative: true,
        },
      };
    }
    case 'enter_downed': {
      const life = enterDownedFromZeroHp(prev, difficulty, {
        explicitDeadly: command.explicitDeadly === true,
      });
      return {
        ok: true,
        life,
        conditions: conditionsFromLife(life),
        eventPayload: {
          op: 'enter_downed',
          characterId: command.characterId,
          participantId: command.participantId,
          status: life.status,
          dyingLevel: life.dyingLevel,
          wounds: life.wounds,
          difficulty: life.difficulty,
          authoritative: true,
        },
      };
    }
    case 'death_save': {
      if (prev.status === 'dead') {
        return { ok: false, reason: 'Charakter ist bereits tot' };
      }
      if (prev.status !== 'downed') {
        return { ok: false, reason: 'Todeswurf nur bei Sterbend' };
      }
      if (!command.grade) {
        return { ok: false, reason: 'grade erforderlich' };
      }
      const life = applyDeathSaveGrade(prev, command.grade);
      return {
        ok: true,
        life,
        conditions: conditionsFromLife(life),
        eventPayload: {
          op: 'death_save',
          characterId: command.characterId,
          participantId: command.participantId,
          grade: command.grade,
          status: life.status,
          dyingLevel: life.dyingLevel,
          authoritative: true,
        },
      };
    }
    case 'stabilize': {
      if (prev.status === 'dead') {
        return { ok: false, reason: 'Tote können nicht stabilisiert werden' };
      }
      if (prev.status !== 'downed' && prev.status !== 'stable') {
        return { ok: false, reason: 'Nur Downed/Stabil können stabilisiert werden' };
      }
      const life = stamp({
        ...prev,
        status: 'stable',
        dyingLevel: 0,
      });
      return {
        ok: true,
        life,
        conditions: conditionsFromLife(life),
        eventPayload: {
          op: 'stabilize',
          characterId: command.characterId,
          participantId: command.participantId,
          status: life.status,
          authoritative: true,
          note: command.note,
        },
      };
    }
    case 'mark_dead': {
      if (command.confirmDead !== true) {
        return { ok: false, reason: 'confirmDead erforderlich für irreversiblen Tod' };
      }
      const life = stamp({
        ...prev,
        status: 'dead',
        dyingLevel: 3,
      });
      return {
        ok: true,
        life,
        conditions: conditionsFromLife(life),
        eventPayload: {
          op: 'mark_dead',
          characterId: command.characterId,
          participantId: command.participantId,
          status: 'dead',
          dyingLevel: 3,
          authoritative: true,
          note: command.note,
        },
      };
    }
    case 'clear_alive': {
      // GM correction / revive — explicit authorized correction
      const life = stamp({
        schemaVersion: LIFE_SCHEMA_VERSION,
        status: 'alive',
        dyingLevel: 0,
        wounds: 0,
        difficulty: prev.difficulty,
      });
      return {
        ok: true,
        life,
        conditions: conditionsFromLife(life),
        eventPayload: {
          op: 'clear_alive',
          characterId: command.characterId,
          participantId: command.participantId,
          status: 'alive',
          authoritative: true,
          note: command.note,
        },
      };
    }
  }
}

/**
 * Merge life presentation tags into an existing condition list (dedupe).
 * Preserves unrelated GM conditions; replaces prior life tags.
 */
export function mergeLifeConditions(
  existing: readonly string[],
  life: CharacterLifeState,
): string[] {
  const lifeTags = new Set([
    'tot',
    'kampfunfähig',
    'bewusstlos',
    'unconscious',
    'stabil',
  ]);
  const kept = existing.filter(
    (c) => !lifeTags.has(c) && !c.startsWith('sterbend:'),
  );
  const projected = conditionsFromLife(life);
  const out: string[] = [...kept];
  for (const tag of projected) {
    if (!out.includes(tag)) out.push(tag);
  }
  return out.slice(0, 24);
}

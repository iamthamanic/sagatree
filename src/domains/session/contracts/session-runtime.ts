/**
 * session-runtime — Authoritative play-session runtime contract (separate from definition DTOs).
 * Location: src/domains/session/contracts/session-runtime.ts
 * Hides: revision concurrency, roster/presence, shared gameplay shape, event kinds.
 * Never imports React or Supabase.
 */
import type { PlaySessionStatus } from './session-lifecycle';
import { normalizePlaySessionStatus } from './session-lifecycle';

/** Minimal append-only audit kinds — not a full event-sourced journal. */
export type SessionEventKind =
  | 'join'
  | 'leave'
  | 'presence'
  | 'status'
  | 'roll'
  | 'damage'
  | 'condition'
  | 'scene'
  | 'combat'
  | 'gameplay'
  | 'program'
  | 'reveal'
  | 'life'
  | 'adventure'
  | 'cue';

const EVENT_KINDS: readonly SessionEventKind[] = [
  'join',
  'leave',
  'presence',
  'status',
  'roll',
  'damage',
  'condition',
  'scene',
  'combat',
  'gameplay',
  'program',
  'reveal',
  'life',
  'adventure',
  'cue',
] as const;

export interface SessionPresenceEntry {
  userId: string;
  characterId: string | null;
  isOnline: boolean;
  joinedAt: string;
}

/**
 * Shared gameplay subset of `sessions.world_state` — not adventure definition data.
 */
export interface SessionGameplayState {
  sceneId: string | null;
  combatActive: boolean;
  shared: Record<string, unknown>;
}

/**
 * Authoritative live runtime snapshot. Distinct from SessionDto / SessionVm (definition + membership).
 */
export interface SessionRuntimeState {
  sessionId: string;
  revision: number;
  status: PlaySessionStatus;
  roster: SessionPresenceEntry[];
  gameplay: SessionGameplayState;
  updatedAt: string;
}

export interface SessionEventRecord {
  id: string;
  sessionId: string;
  kind: SessionEventKind;
  actorUserId: string | null;
  payload: Record<string, unknown>;
  revisionAfter: number;
  createdAt: string;
  idempotencyKey: string | null;
}

export class StaleRuntimeRevisionError extends Error {
  readonly expected: number;
  readonly actual: number;

  constructor(expected: number, actual: number) {
    super(`Veraltete Session-Revision: erwartet ${expected}, aktuell ${actual}`);
    this.name = 'StaleRuntimeRevisionError';
    this.expected = expected;
    this.actual = actual;
  }
}

export function isSessionEventKind(value: string): value is SessionEventKind {
  return (EVENT_KINDS as readonly string[]).includes(value);
}

export function assertSessionEventKind(value: string): SessionEventKind {
  if (!isSessionEventKind(value)) {
    throw new Error(`Unbekannte Session-Event-Art: ${value}`);
  }
  return value;
}

export function emptyGameplayState(): SessionGameplayState {
  return { sceneId: null, combatActive: false, shared: {} };
}

/**
 * Parse gameplay from sessions.world_state JSONB without inventing elevated fields.
 */
export function parseGameplayFromWorldState(worldState: unknown): SessionGameplayState {
  if (!worldState || typeof worldState !== 'object' || Array.isArray(worldState)) {
    return emptyGameplayState();
  }
  const raw = worldState as Record<string, unknown>;
  const sceneRaw = raw.sceneId ?? raw.scene_id;
  const sceneId = typeof sceneRaw === 'string' && sceneRaw.trim() !== '' ? sceneRaw : null;
  const combatActive = raw.combatActive === true || raw.combat_active === true;
  const sharedRaw = raw.shared;
  const shared =
    sharedRaw && typeof sharedRaw === 'object' && !Array.isArray(sharedRaw)
      ? (sharedRaw as Record<string, unknown>)
      : {};
  return { sceneId, combatActive, shared };
}

export function gameplayToWorldStatePatch(gameplay: SessionGameplayState): Record<string, unknown> {
  return {
    sceneId: gameplay.sceneId,
    combatActive: gameplay.combatActive,
    shared: gameplay.shared,
  };
}

export function assertExpectedRevision(expected: number, actual: number): void {
  if (!Number.isFinite(expected) || !Number.isFinite(actual) || expected !== actual) {
    throw new StaleRuntimeRevisionError(expected, actual);
  }
}

export function isStaleRevision(clientRevision: number, serverRevision: number): boolean {
  return clientRevision !== serverRevision;
}

/**
 * Merge a presence row into roster immutably (domain helper for client apply).
 */
export function upsertRosterPresence(
  roster: readonly SessionPresenceEntry[],
  entry: SessionPresenceEntry,
): SessionPresenceEntry[] {
  const without = roster.filter((r) => r.userId !== entry.userId);
  return [...without, entry];
}

export function removeRosterUser(
  roster: readonly SessionPresenceEntry[],
  userId: string,
): SessionPresenceEntry[] {
  return roster.filter((r) => r.userId !== userId);
}

export function normalizeRuntimeStatus(raw: string): PlaySessionStatus {
  return normalizePlaySessionStatus(raw);
}

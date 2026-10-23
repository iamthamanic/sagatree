/**
 * Host-side mirror of `src/domains/session/contracts/session-runtime.ts` (+ lifecycle).
 * Location: server/src/modules/session/internal/session-runtime-domain.ts
 *
 * Node host ESM cannot import the Vite-era extensionless domain barrels directly.
 * Field names / event kinds / status edges MUST stay 1:1 with the domain contracts.
 * MIG-022 self-test asserts snapshot shape parity against the domain source text.
 */

export type PlaySessionStatus = 'waiting' | 'active' | 'paused' | 'completed';

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
];

const STATUS_EDGES: Record<PlaySessionStatus, readonly PlaySessionStatus[]> = {
  waiting: ['active', 'completed'],
  active: ['paused', 'completed'],
  paused: ['active', 'completed'],
  completed: [],
};

export type SessionPresenceEntry = {
  userId: string;
  characterId: string | null;
  isOnline: boolean;
  joinedAt: string;
};

export type SessionGameplayState = {
  sceneId: string | null;
  combatActive: boolean;
  shared: Record<string, unknown>;
};

/** Authoritative live runtime snapshot — same fields as domain SessionRuntimeState. */
export type SessionRuntimeState = {
  sessionId: string;
  revision: number;
  status: PlaySessionStatus;
  roster: SessionPresenceEntry[];
  gameplay: SessionGameplayState;
  updatedAt: string;
};

export function emptyGameplayState(): SessionGameplayState {
  return { sceneId: null, combatActive: false, shared: {} };
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

export function normalizePlaySessionStatus(raw: string): PlaySessionStatus {
  if (raw === 'scheduled' || raw === 'waiting') return 'waiting';
  if (raw === 'active' || raw === 'paused' || raw === 'completed') return raw;
  throw new Error(`Unbekannter Session-Status: ${raw}`);
}

export function assertPlaySessionStatusTransition(from: PlaySessionStatus, to: PlaySessionStatus): void {
  if (!STATUS_EDGES[from].includes(to)) {
    throw new Error(`Ungültiger Statuswechsel: ${from} → ${to}`);
  }
}

/**
 * session-lifecycle — Pure status-transition and join-payload rules for play sessions.
 * Location: src/domains/session/contracts/session-lifecycle.ts
 * Hides: which status edges are legal; never touches backend clients/React.
 */

export type PlaySessionStatus = 'waiting' | 'active' | 'paused' | 'completed';

const ALLOWED: Record<PlaySessionStatus, readonly PlaySessionStatus[]> = {
  waiting: ['active', 'completed'],
  active: ['paused', 'completed'],
  paused: ['active', 'completed'],
  completed: [],
};

/** Map DB `scheduled` (project create) onto play-session `waiting`. */
export function normalizePlaySessionStatus(raw: string): PlaySessionStatus {
  if (raw === 'scheduled' || raw === 'waiting') return 'waiting';
  if (raw === 'active' || raw === 'paused' || raw === 'completed') return raw;
  throw new Error(`Unbekannter Session-Status: ${raw}`);
}

export function canTransitionPlaySessionStatus(
  from: PlaySessionStatus,
  to: PlaySessionStatus,
): boolean {
  return ALLOWED[from].includes(to);
}

export function assertPlaySessionStatusTransition(
  from: PlaySessionStatus,
  to: PlaySessionStatus,
): void {
  if (!canTransitionPlaySessionStatus(from, to)) {
    throw new Error(`Ungültiger Statuswechsel: ${from} → ${to}`);
  }
}

export function normalizeSessionJoinCode(code: string): string {
  const trimmed = code.trim().toUpperCase();
  if (trimmed.length < 6) {
    throw new Error('Session-Code muss mindestens 6 Zeichen haben');
  }
  return trimmed;
}

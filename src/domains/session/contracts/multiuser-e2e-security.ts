/**
 * multiuser-e2e-security — Phase 8 checklist + security failure classification (#303 / Epic #210).
 * Location: src/domains/session/contracts/multiuser-e2e-security.ts
 * Hides: Playwright/account wiring; pure contract for gate + client error mapping.
 * Never imports React or backend clients.
 */

/** Ordered Phase 8 vertical-slice steps from Epic #210. */
export const PHASE8_E2E_STEPS = [
  'gm_creates_session',
  'players_join_with_characters',
  'roster_realtime_updates',
  'shared_check_and_drive',
  'gm_changes_scene',
  'encounter_starts',
  'npc_hp_condition_visible',
  'player_takes_damage',
  'player_reload_reconnect',
  'state_identical_after_reload',
  'unauthorized_writes_rejected',
  'session_pause_resume_complete',
] as const;

export type Phase8E2EStep = (typeof PHASE8_E2E_STEPS)[number];

export const PHASE8_FAILURE_CASES = [
  'duplicate_command',
  'stale_revision',
  'completed_session',
  'unauthorized_actor',
  'unauthenticated',
] as const;

export type Phase8FailureCase = (typeof PHASE8_FAILURE_CASES)[number];

export type RuntimeSecurityClass =
  | 'ok'
  | 'unauthenticated'
  | 'forbidden'
  | 'stale_revision'
  | 'session_closed'
  | 'not_found'
  | 'invalid_input'
  | 'unknown';

/**
 * Classify RPC / REST error text into a stable security class for UI + E2E asserts.
 */
export function classifyRuntimeSecurityError(message: string): RuntimeSecurityClass {
  const m = message.trim().toLowerCase();
  if (!m) return 'unknown';
  if (m.includes('authentication required') || m.includes('not authenticated')) {
    return 'unauthenticated';
  }
  if (m.includes('stale revision') || m.includes('40001')) {
    return 'stale_revision';
  }
  if (
    m.includes('completed sessions cannot') ||
    m.includes('session is completed') ||
    m.includes('session is expired') ||
    m.includes('expired session')
  ) {
    return 'session_closed';
  }
  if (m.includes('forbidden') || m.includes('42501') || m.includes('not owned')) {
    return 'forbidden';
  }
  if (m.includes('session not found') || m.includes('p0002')) {
    return 'not_found';
  }
  if (m.includes('invalid') || m.includes('required') || m.includes('22023')) {
    return 'invalid_input';
  }
  return 'unknown';
}

export interface IdempotencyReplayDecision {
  isReplay: boolean;
  applyMutation: boolean;
}

/**
 * Same non-empty idempotency key → replay prior result; do not apply mutation again.
 * ponytail: mirrors SQL unique index on (session_id, idempotency_key).
 */
export function decideIdempotencyReplay(
  incomingKey: string | null | undefined,
  priorKeys: readonly string[],
): IdempotencyReplayDecision {
  const key = typeof incomingKey === 'string' ? incomingKey.trim() : '';
  if (!key) {
    return { isReplay: false, applyMutation: true };
  }
  if (priorKeys.includes(key)) {
    return { isReplay: true, applyMutation: false };
  }
  return { isReplay: false, applyMutation: true };
}

export interface StaleRevisionDecision {
  accept: boolean;
  class: RuntimeSecurityClass;
}

export function decideStaleRevision(clientRevision: number, serverRevision: number): StaleRevisionDecision {
  if (
    !Number.isFinite(clientRevision) ||
    !Number.isFinite(serverRevision) ||
    clientRevision !== serverRevision
  ) {
    return { accept: false, class: 'stale_revision' };
  }
  return { accept: true, class: 'ok' };
}

export type SessionCommandGateStatus = 'waiting' | 'active' | 'paused' | 'completed';

export interface CommandAuthorizationInput {
  actorUserId: string | null;
  isParticipant: boolean;
  isGm: boolean;
  sessionStatus: SessionCommandGateStatus;
  requiresGm: boolean;
  clientRevision: number;
  serverRevision: number;
  idempotencyKey?: string | null;
  priorIdempotencyKeys?: readonly string[];
}

export interface CommandAuthorizationResult {
  allowed: boolean;
  class: RuntimeSecurityClass;
  isReplay: boolean;
}

/**
 * Client-side mirror of server fail-closed rules for E2E / UI preflight (server remains SoT).
 */
export function authorizeSessionCommand(input: CommandAuthorizationInput): CommandAuthorizationResult {
  if (!input.actorUserId) {
    return { allowed: false, class: 'unauthenticated', isReplay: false };
  }
  if (!input.isParticipant) {
    return { allowed: false, class: 'forbidden', isReplay: false };
  }
  if (input.sessionStatus === 'completed') {
    return { allowed: false, class: 'session_closed', isReplay: false };
  }
  if (input.requiresGm && !input.isGm) {
    return { allowed: false, class: 'forbidden', isReplay: false };
  }
  const stale = decideStaleRevision(input.clientRevision, input.serverRevision);
  if (!stale.accept) {
    return { allowed: false, class: 'stale_revision', isReplay: false };
  }
  const replay = decideIdempotencyReplay(input.idempotencyKey, input.priorIdempotencyKeys ?? []);
  if (replay.isReplay) {
    return { allowed: true, class: 'ok', isReplay: true };
  }
  return { allowed: true, class: 'ok', isReplay: false };
}

export function isCompletePhase8Checklist(done: readonly Phase8E2EStep[]): boolean {
  return PHASE8_E2E_STEPS.every((step) => done.includes(step));
}

export function missingPhase8Steps(done: readonly Phase8E2EStep[]): Phase8E2EStep[] {
  return PHASE8_E2E_STEPS.filter((step) => !done.includes(step));
}

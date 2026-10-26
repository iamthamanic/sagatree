/**
 * create_play_session use-case (RPC-SESSION-LIFECYCLE / #868).
 * Location: server/src/application/session-lifecycle/create_play_session/index.ts
 *
 * GM-only; creates waiting play session with unique number + join code.
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SessionPorts } from '../../../modules/session/index.ts';

export function createPlaySessionUseCase(session: SessionPorts) {
  return (actor: Actor, projectId: string, name?: string | null) =>
    session.lifecycle.createPlaySession(actor, projectId, name ?? null);
}

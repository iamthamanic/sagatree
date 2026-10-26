/**
 * leave_play_session use-case (RPC-SESSION-ACCESS / #869).
 * Location: server/src/application/session-access/leave_play_session/index.ts
 *
 * Foreign leave is a no-op (no revision/event) — RPC-SEC-LEAVE-FOREIGN.
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SessionPorts } from '../../../modules/session/index.ts';

export function leavePlaySessionUseCase(session: SessionPorts) {
  return (actor: Actor, sessionId: string) =>
    session.access.leavePlaySession(actor, sessionId);
}

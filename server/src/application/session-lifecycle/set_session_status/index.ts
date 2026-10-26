/**
 * set_session_status use-case (RPC-SESSION-LIFECYCLE / #868).
 * Location: server/src/application/session-lifecycle/set_session_status/index.ts
 *
 * GM-only transitions; completed writes recap + status event atomically.
 * No public append_session_event (RPC-SEC-ANON-EVENT-HELPER deny).
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SessionPorts } from '../../../modules/session/index.ts';

export function setSessionStatusUseCase(session: SessionPorts) {
  return (actor: Actor, sessionId: string, status: string) =>
    session.lifecycle.setSessionStatus(actor, sessionId, status);
}

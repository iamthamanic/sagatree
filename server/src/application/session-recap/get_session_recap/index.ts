/**
 * get_session_recap use-case (RPC-SESSION-RECAP / #870).
 * Location: server/src/application/session-recap/get_session_recap/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SessionPorts } from '../../../modules/session/index.ts';

export function getSessionRecapUseCase(session: SessionPorts) {
  return (actor: Actor, sessionId: string) =>
    session.recap.getSessionRecap(actor, sessionId);
}

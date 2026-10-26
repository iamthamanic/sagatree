/**
 * create_session_invite use-case (RPC-SESSION-ACCESS / #869).
 * Location: server/src/application/session-access/create_session_invite/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SessionPorts } from '../../../modules/session/index.ts';

export function createSessionInviteUseCase(session: SessionPorts) {
  return (actor: Actor, sessionId: string) =>
    session.access.createSessionInvite(actor, sessionId);
}

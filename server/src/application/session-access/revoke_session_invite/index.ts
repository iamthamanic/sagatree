/**
 * revoke_session_invite use-case (RPC-SESSION-ACCESS / #869).
 * Location: server/src/application/session-access/revoke_session_invite/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SessionPorts } from '../../../modules/session/index.ts';

export function revokeSessionInviteUseCase(session: SessionPorts) {
  return (actor: Actor, token: string) =>
    session.access.revokeSessionInvite(actor, token);
}

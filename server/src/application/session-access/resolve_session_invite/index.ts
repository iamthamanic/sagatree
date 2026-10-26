/**
 * resolve_session_invite use-case (RPC-SESSION-ACCESS / #869).
 * Location: server/src/application/session-access/resolve_session_invite/index.ts
 *
 * Facts only — does not join the session.
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SessionPorts } from '../../../modules/session/index.ts';

export function resolveSessionInviteUseCase(session: SessionPorts) {
  return (actor: Actor, token: string) =>
    session.access.resolveSessionInvite(actor, token);
}

/**
 * join_session_by_code use-case (RPC-SESSION-ACCESS / #869).
 * Location: server/src/application/session-access/join_session_by_code/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SessionPorts } from '../../../modules/session/index.ts';

export function joinSessionByCodeUseCase(session: SessionPorts) {
  return (actor: Actor, code: string, characterId?: string | null) =>
    session.access.joinSessionByCode(actor, code, characterId ?? null);
}

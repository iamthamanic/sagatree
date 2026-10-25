/**
 * set_session_player_presence use-case (RPC-SESSION-RUNTIME / #867).
 * Location: server/src/application/session-runtime/set_session_player_presence/index.ts
 *
 * Presence is a first-class runtime kind — not lifecycle join/leave.
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SessionPorts } from '../../../modules/session/index.ts';
import { applySessionRuntimeCommandUseCase } from '../apply_session_runtime_command/index.ts';

export function setSessionPlayerPresenceUseCase(session: SessionPorts) {
  const apply = applySessionRuntimeCommandUseCase(session);

  return (
    actor: Actor,
    input: {
      readonly sessionId: string;
      readonly expectedRevision: number;
      readonly idempotencyKey: string;
      readonly presence: Record<string, unknown>;
    },
  ) =>
    apply(actor, {
      sessionId: input.sessionId,
      expectedRevision: input.expectedRevision,
      idempotencyKey: input.idempotencyKey,
      op: { kind: 'presence', payload: input.presence },
    });
}

/**
 * apply_session_runtime_command use-case (RPC-SESSION-RUNTIME / #867).
 * Location: server/src/application/session-runtime/apply_session_runtime_command/index.ts
 *
 * Thin SQLSTATE-shaped facade over MIG-022 SessionPorts.commands.apply.
 * Direct append_session_event helpers are not exposed (RPC-SEC-ANON-EVENT-HELPER deny).
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { ApplyCommandInput, SessionPorts } from '../../../modules/session/index.ts';
import { mapSessionRuntimeError } from '../map-session-error.ts';

export function applySessionRuntimeCommandUseCase(session: SessionPorts) {
  return (actor: Actor, command: ApplyCommandInput) => {
    const result = session.commands.apply(actor, command);
    if (!result.ok) {
      return {
        ok: false as const,
        error: mapSessionRuntimeError(result.error),
        expected: result.expected,
        actual: result.actual,
      };
    }
    return {
      ok: true as const,
      value: {
        committed: result.committed,
        snapshot: result.snapshot,
      },
    };
  };
}

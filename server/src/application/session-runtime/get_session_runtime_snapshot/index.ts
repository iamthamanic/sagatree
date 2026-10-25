/**
 * get_session_runtime_snapshot use-case (RPC-SESSION-RUNTIME / #867).
 * Location: server/src/application/session-runtime/get_session_runtime_snapshot/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SessionPorts } from '../../../modules/session/index.ts';
import { mapSessionRuntimeError } from '../map-session-error.ts';

export function getSessionRuntimeSnapshotUseCase(session: SessionPorts) {
  return (actor: Actor, sessionId: string) => {
    const result = session.queries.getSnapshot(actor, sessionId);
    if (!result.ok) {
      return { ok: false as const, error: mapSessionRuntimeError(result.error) };
    }
    return {
      ok: true as const,
      value: {
        snapshot: result.snapshot,
        projectId: result.projectId,
      },
    };
  };
}

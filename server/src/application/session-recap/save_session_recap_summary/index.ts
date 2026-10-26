/**
 * save_session_recap_summary use-case (RPC-SESSION-RECAP / #870).
 * Location: server/src/application/session-recap/save_session_recap_summary/index.ts
 *
 * Host exposes the unambiguous 3-arg contract only (status required).
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SessionPorts } from '../../../modules/session/index.ts';

export function saveSessionRecapSummaryUseCase(session: SessionPorts) {
  return (
    actor: Actor,
    sessionId: string,
    summaryText: string | null,
    status: string,
  ) => session.recap.saveSessionRecapSummary(actor, sessionId, summaryText, status);
}

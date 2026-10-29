/**
 * session-outcome-promotion-service — RPC wrappers for #582 promote.
 * Location: src/infrastructure/saga/session-outcome-promotion-service.ts
 *
 * Dual-path (MIG-310): production remains Supabase RPCs via typed callPromote.
 * Host ports are bound via `createHostSagaAdapter` for tests / future cutover
 * (no accidental cutover — VITE host flags alone do not redirect this facade).
 */
import { supabase } from '../../lib/supabase';
import {
  parsePromoteRpcResult,
  type PromoteRpcResult,
} from '../../domains/session/contracts/session-outcome-promotion';

async function callPromote(
  rpc: 'promote_session_outcome_to_saga' | 'promote_session_outcome_to_world',
  sessionId: string,
  consequenceId: string,
): Promise<PromoteRpcResult> {
  const { data, error } = await supabase.rpc(rpc, {
    p_session_id: sessionId,
    p_consequence_id: consequenceId,
  });
  if (error) {
    console.error(`[session-outcome-promotion] ${rpc} failed`, error);
    return {
      ok: false,
      messageDe: error.message || 'Übernehmen fehlgeschlagen',
    };
  }
  return parsePromoteRpcResult(data);
}

export const sessionOutcomePromotionService = {
  promoteToSaga(sessionId: string, consequenceId: string): Promise<PromoteRpcResult> {
    return callPromote('promote_session_outcome_to_saga', sessionId, consequenceId);
  },
  promoteToWorld(sessionId: string, consequenceId: string): Promise<PromoteRpcResult> {
    return callPromote('promote_session_outcome_to_world', sessionId, consequenceId);
  },
};

/**
 * session-outcome-promotion-service — RPC / host wrappers for #582 promote.
 * Location: src/infrastructure/saga/session-outcome-promotion-service.ts
 *
 * Dual-path (MIG-310): host-first uses promote HTTP over SagaInfraPorts (CUT-05);
 * legacy remains Supabase RPCs via typed callPromote.
 */
import { supabase } from '../../lib/supabase';
import { isHostLibraryEnabled } from '../host/host-library-http';
import {
  promoteHostSessionOutcomeToSaga,
  promoteHostSessionOutcomeToWorld,
} from '../host/host-session-http';
import {
  parsePromoteRpcResult,
  type PromoteRpcResult,
} from '../../domains/session/contracts/session-outcome-promotion';

function hostErrorToResult(message: string): PromoteRpcResult {
  // Strip SQLSTATE / P-code prefixes when present ("42501:Nur …").
  const colon = message.indexOf(':');
  const messageDe =
    colon > 0 && /^[A-Z0-9]+$/i.test(message.slice(0, colon).trim())
      ? message.slice(colon + 1).trim() || message
      : message;
  return {
    ok: false,
    messageDe: messageDe || 'Übernehmen fehlgeschlagen',
  };
}

async function callPromote(
  rpc: 'promote_session_outcome_to_saga' | 'promote_session_outcome_to_world',
  sessionId: string,
  consequenceId: string,
): Promise<PromoteRpcResult> {
  if (isHostLibraryEnabled()) {
    try {
      const dto =
        rpc === 'promote_session_outcome_to_saga'
          ? await promoteHostSessionOutcomeToSaga(sessionId, consequenceId)
          : await promoteHostSessionOutcomeToWorld(sessionId, consequenceId);
      return parsePromoteRpcResult(dto);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // hostMutateJson prefixes unreachableMessage — peel trailing detail.
      const detailMatch = message.match(/: (.+)$/);
      return hostErrorToResult(detailMatch ? detailMatch[1] : message);
    }
  }
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

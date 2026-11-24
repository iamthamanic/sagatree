/**
 * session-outcome-promotion-service — Host HTTP for #582 promote.
 * Location: src/infrastructure/saga/session-outcome-promotion-service.ts
 *
 * CUT-20: host session HTTP only — no Supabase RPC.
 */
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
  kind: 'saga' | 'world',
  sessionId: string,
  consequenceId: string,
): Promise<PromoteRpcResult> {
  if (!isHostLibraryEnabled()) {
    return {
      ok: false,
      messageDe: 'Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).',
    };
  }
  try {
    const dto =
      kind === 'saga'
        ? await promoteHostSessionOutcomeToSaga(sessionId, consequenceId)
        : await promoteHostSessionOutcomeToWorld(sessionId, consequenceId);
    return parsePromoteRpcResult(dto);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const detailMatch = message.match(/: (.+)$/);
    return hostErrorToResult(detailMatch ? detailMatch[1] : message);
  }
}

export const sessionOutcomePromotionService = {
  promoteToSaga(sessionId: string, consequenceId: string): Promise<PromoteRpcResult> {
    return callPromote('saga', sessionId, consequenceId);
  },
  promoteToWorld(sessionId: string, consequenceId: string): Promise<PromoteRpcResult> {
    return callPromote('world', sessionId, consequenceId);
  },
};

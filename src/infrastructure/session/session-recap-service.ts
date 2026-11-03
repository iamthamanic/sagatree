/**
 * session-recap-service — Load persisted episode recaps via get_session_recap (#572).
 * Location: src/infrastructure/session/session-recap-service.ts
 */
import { supabase } from '../../lib/supabase';
import { raceWithTimeoutReject, SUPABASE_QUERY_TIMEOUT_MS } from '../../lib/networkTimeout';
import {
  parsePersistedRecapHighlightLines,
  type RecapHighlightLine,
} from '../../domains/session/contracts/session-prepare-recap';
import { fetchHostSessionRecap, isHostLibraryEnabled } from '../host/host-session-http';

export type SessionRecapDto = {
  readonly sessionId: string;
  readonly summaryText: string | null;
  /** #573 — none|draft|approved (players only receive approved text). */
  readonly summaryStatus: 'none' | 'draft' | 'approved';
  readonly highlights: readonly RecapHighlightLine[];
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class SessionRecapService {
  async getBySessionId(sessionId: string): Promise<SessionRecapDto | null> {
    if (isHostLibraryEnabled()) {
      const data = await fetchHostSessionRecap(sessionId);
      if (data == null) return null;
      if (!isRecord(data)) {
        throw new Error('Ungültige Recap-Antwort');
      }
      const statusRaw = typeof data.summaryStatus === 'string' ? data.summaryStatus : 'none';
      const summaryStatus =
        statusRaw === 'approved' || statusRaw === 'draft' ? statusRaw : 'none';
      return {
        sessionId: typeof data.sessionId === 'string' ? data.sessionId : sessionId,
        summaryText: typeof data.summaryText === 'string' ? data.summaryText : null,
        summaryStatus,
        highlights: parsePersistedRecapHighlightLines(data.highlightLines),
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
      };
    }
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('get_session_recap', { p_session_id: sessionId }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Recap Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Recap konnte nicht geladen werden');
    }
    if (data == null) return null;
    if (!isRecord(data)) {
      throw new Error('Ungültige Recap-Antwort');
    }
    const statusRaw = typeof data.summaryStatus === 'string' ? data.summaryStatus : 'none';
    const summaryStatus =
      statusRaw === 'approved' || statusRaw === 'draft' ? statusRaw : 'none';
    return {
      sessionId: typeof data.sessionId === 'string' ? data.sessionId : sessionId,
      summaryText: typeof data.summaryText === 'string' ? data.summaryText : null,
      summaryStatus,
      highlights: parsePersistedRecapHighlightLines(data.highlightLines),
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    };
  }
}

export const sessionRecapService = new SessionRecapService();

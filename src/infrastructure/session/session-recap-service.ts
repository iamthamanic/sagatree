/**
 * session-recap-service — Load persisted episode recaps (CUT-20).
 * Location: src/infrastructure/session/session-recap-service.ts
 */
import {
  parsePersistedRecapHighlightLines,
  type RecapHighlightLine,
} from '../../domains/session/contracts/session-prepare-recap';
import { fetchHostSessionRecap, isHostLibraryEnabled } from '../host/host-session-http';

export type SessionRecapDto = {
  readonly sessionId: string;
  readonly summaryText: string | null;
  readonly summaryStatus: 'none' | 'draft' | 'approved';
  readonly highlights: readonly RecapHighlightLine[];
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

class SessionRecapService {
  async getBySessionId(sessionId: string): Promise<SessionRecapDto | null> {
    assertHost();
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
}

export const sessionRecapService = new SessionRecapService();

/**
 * session-runtime-channel — Polling adapter for SessionRuntimeState (CUT-20).
 * Location: src/infrastructure/session/session-runtime-channel.ts
 */
import type { SessionRuntimeState } from '../../domains/session/contracts/session-runtime';
import { isHostLibraryEnabled } from '../host/host-session-http';
import { sessionRuntimeService } from './session-runtime-service';

export type SessionRuntimeListener = (state: SessionRuntimeState) => void;

export interface SessionRuntimeSubscription {
  getState: () => SessionRuntimeState | null;
  resync: () => Promise<SessionRuntimeState>;
  unsubscribe: () => Promise<void>;
}

const HOST_RUNTIME_POLL_MS = 2_500;

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

/**
 * Load authoritative snapshot, then poll host HTTP for updates.
 */
export async function subscribeSessionRuntime(
  sessionId: string,
  onChange: SessionRuntimeListener,
): Promise<SessionRuntimeSubscription> {
  assertHost();
  let current: SessionRuntimeState | null = await sessionRuntimeService.getSnapshot(sessionId);
  onChange(current);

  let disposed = false;
  const pollTimer = setInterval(() => {
    void sessionRuntimeService
      .getSnapshot(sessionId)
      .then((next) => {
        current = next;
        if (!disposed) onChange(next);
      })
      .catch(() => {
        /* keep last good snapshot */
      });
  }, HOST_RUNTIME_POLL_MS);

  const refresh = async (): Promise<SessionRuntimeState> => {
    const next = await sessionRuntimeService.getSnapshot(sessionId);
    current = next;
    if (!disposed) onChange(next);
    return next;
  };

  return {
    getState: () => current,
    resync: refresh,
    unsubscribe: async () => {
      disposed = true;
      clearInterval(pollTimer);
    },
  };
}

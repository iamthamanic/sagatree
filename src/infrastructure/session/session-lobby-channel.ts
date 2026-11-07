/**
 * session-lobby-channel — Ephemeral ready-state for Lobby preflight (#491 / CUT-20).
 * Location: src/infrastructure/session/session-lobby-channel.ts
 *
 * Host product has no Supabase Realtime — local echo until a host broadcast ships (#1159).
 */
import { isHostLibraryEnabled } from '../host/host-session-http';

export type LobbyReadyPayload = {
  readonly userId: string;
  readonly ready: boolean;
};

export type LobbyReadyListener = (payload: LobbyReadyPayload) => void;

export type SessionLobbySubscription = {
  sendReady: (payload: LobbyReadyPayload) => Promise<void>;
  unsubscribe: () => Promise<void>;
};

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

export async function subscribeSessionLobbyReady(
  sessionId: string,
  onReady: LobbyReadyListener,
): Promise<SessionLobbySubscription> {
  assertHost();
  void sessionId;
  let disposed = false;
  return {
    sendReady: async (payload) => {
      if (disposed) return;
      onReady({ userId: payload.userId, ready: payload.ready === true });
    },
    unsubscribe: async () => {
      disposed = true;
    },
  };
}

/**
 * session-lobby-channel — Ephemeral ready-state broadcast for Lobby preflight (#491).
 * Location: src/infrastructure/session/session-lobby-channel.ts
 *
 * Hides Supabase Realtime. Ready is not gameplay authorization.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
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

/**
 * Lobby ready is non-authoritative (MIG-311). On host dual-path, use a local
 * echo until a host broadcast room ships — still fail-closed for gameplay ACL.
 */
export async function subscribeSessionLobbyReady(
  sessionId: string,
  onReady: LobbyReadyListener,
): Promise<SessionLobbySubscription> {
  if (isHostLibraryEnabled()) {
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

  let channel: RealtimeChannel | null = null;
  let disposed = false;

  const topic = `session-lobby:${sessionId}`;
  channel = supabase
    .channel(topic)
    .on('broadcast', { event: 'ready' }, ({ payload }) => {
      if (disposed) return;
      const userId = typeof payload?.userId === 'string' ? payload.userId : null;
      if (!userId) return;
      onReady({ userId, ready: payload?.ready === true });
    });

  await new Promise<void>((resolve, reject) => {
    if (!channel) {
      reject(new Error('Lobby-Kanal fehlt'));
      return;
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error(`Lobby-Kanal: ${status}`));
      }
    });
  });

  return {
    sendReady: async (payload) => {
      if (!channel || disposed) return;
      await channel.send({
        type: 'broadcast',
        event: 'ready',
        payload: { userId: payload.userId, ready: payload.ready === true },
      });
    },
    unsubscribe: async () => {
      disposed = true;
      if (channel) {
        await supabase.removeChannel(channel);
        channel = null;
      }
    },
  };
}

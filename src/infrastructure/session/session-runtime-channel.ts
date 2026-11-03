/**
 * session-runtime-channel — Snapshot-then-subscribe Realtime adapter for SessionRuntimeState.
 * Location: src/infrastructure/session/session-runtime-channel.ts
 * Hides: Supabase channel wiring; callers get domain snapshots via callback.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { SessionRuntimeState } from '../../domains/session/contracts/session-runtime';
import { isHostLibraryEnabled } from '../host/host-session-http';
import { sessionRuntimeService } from './session-runtime-service';

export type SessionRuntimeListener = (state: SessionRuntimeState) => void;

export interface SessionRuntimeSubscription {
  /** Latest authoritative snapshot after connect or resync. */
  getState: () => SessionRuntimeState | null;
  /** Force snapshot reload + keep channel (reconnect path). */
  resync: () => Promise<SessionRuntimeState>;
  unsubscribe: () => Promise<void>;
}

const HOST_RUNTIME_POLL_MS = 2_500;

/**
 * Load authoritative snapshot, then subscribe to postgres_changes on sessions,
 * session_players, and session_events. On any change, re-fetch snapshot (avoid
 * last-write-wins client merges).
 *
 * Host dual-path: poll runtime HTTP (no Supabase Realtime on solo host).
 */
export async function subscribeSessionRuntime(
  sessionId: string,
  onChange: SessionRuntimeListener,
): Promise<SessionRuntimeSubscription> {
  let current: SessionRuntimeState | null = await sessionRuntimeService.getSnapshot(sessionId);
  onChange(current);

  let channel: RealtimeChannel | null = null;
  let disposed = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  if (isHostLibraryEnabled()) {
    const refresh = async (): Promise<SessionRuntimeState> => {
      const next = await sessionRuntimeService.getSnapshot(sessionId);
      current = next;
      if (!disposed) onChange(next);
      return next;
    };
    pollTimer = setInterval(() => {
      void refresh().catch(() => {
        /* keep last good snapshot */
      });
    }, HOST_RUNTIME_POLL_MS);
    return {
      getState: () => current,
      resync: refresh,
      unsubscribe: async () => {
        disposed = true;
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      },
    };
  }

  const refresh = async (): Promise<SessionRuntimeState> => {
    const next = await sessionRuntimeService.getSnapshot(sessionId);
    current = next;
    if (!disposed) onChange(next);
    return next;
  };

  const topic = `session-runtime:${sessionId}`;
  channel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
      () => {
        void refresh();
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'session_players',
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        void refresh();
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'session_events',
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        void refresh();
      },
    );

  await new Promise<void>((resolve, reject) => {
    if (!channel) {
      reject(new Error('Realtime-Kanal konnte nicht erstellt werden'));
      return;
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error(`Realtime-Subscribe fehlgeschlagen: ${status}`));
      }
    });
  });

  return {
    getState: () => current,
    resync: refresh,
    unsubscribe: async () => {
      disposed = true;
      if (channel) {
        await supabase.removeChannel(channel);
        channel = null;
      }
    },
  };
}

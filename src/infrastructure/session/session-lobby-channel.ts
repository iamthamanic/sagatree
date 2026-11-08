/**
 * session-lobby-channel — Ephemeral ready-state for Lobby preflight (#491 / CUT-04b).
 * Location: src/infrastructure/session/session-lobby-channel.ts
 *
 * Host realtime SSE fan-out (no Supabase Realtime). Ready is never gameplay auth.
 */
import { getHostAuthBaseUrl } from '../../lib/hostAuthBridge';
import {
  isHostLibraryEnabled,
  publishHostSessionLobbyReady,
} from '../host/host-session-http';

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

function parseSseReadyChunk(
  buffer: string,
  onReady: LobbyReadyListener,
): string {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  for (const block of parts) {
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }
    if (dataLines.length === 0) continue;
    try {
      const parsed: unknown = JSON.parse(dataLines.join('\n'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      const record = parsed as Record<string, unknown>;
      if (record.type !== 'ready') continue;
      const userId = typeof record.userId === 'string' ? record.userId : null;
      if (!userId) continue;
      onReady({ userId, ready: record.ready === true });
    } catch {
      /* ignore malformed frames */
    }
  }
  return rest;
}

async function openLobbyReadyStream(
  streamUrl: string,
  signal: AbortSignal,
): Promise<Response> {
  const response = await fetch(streamUrl, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'text/event-stream' },
    signal,
  });
  if (!response.ok || !response.body) {
    let detail = '';
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object' && 'error' in body) {
        detail = String((body as { error: unknown }).error);
      }
    } catch {
      /* ignore */
    }
    throw new Error(
      detail ? `Lobby-Kanal: ${detail}` : `Lobby-Kanal: HTTP ${response.status}`,
    );
  }
  return response;
}

/**
 * Subscribe to multiplayer lobby ready via host SSE + POST publish.
 * Server stamps actor identity; client userId on send is ignored for auth.
 */
export async function subscribeSessionLobbyReady(
  sessionId: string,
  onReady: LobbyReadyListener,
): Promise<SessionLobbySubscription> {
  assertHost();
  const base = getHostAuthBaseUrl();
  if (base === null) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
  if (!sessionId.trim()) {
    throw new Error('Lobby-Kanal: Session fehlt');
  }

  const abort = new AbortController();
  const streamUrl = `${base}/api/v1/sessions/${encodeURIComponent(sessionId)}/lobby/ready/stream`;

  let disposed = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const pump = async () => {
    let delayMs = 500;
    while (!disposed && !abort.signal.aborted) {
      try {
        const response = await openLobbyReadyStream(streamUrl, abort.signal);
        reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let pending = '';
        delayMs = 500;
        while (!disposed) {
          const { done, value } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          pending = parseSseReadyChunk(pending, (payload) => {
            if (!disposed) onReady(payload);
          });
        }
      } catch (err) {
        if (disposed || abort.signal.aborted) return;
        /* transient drop — retry with cancellation-aware backoff */
      } finally {
        try {
          await reader?.cancel();
        } catch {
          /* ignore */
        }
        reader = null;
      }
      if (disposed || abort.signal.aborted) return;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, delayMs);
        abort.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });
      delayMs = Math.min(delayMs * 2, 8_000);
    }
  };

  // Establish first connection before returning so early failures surface.
  try {
    const response = await openLobbyReadyStream(streamUrl, abort.signal);
    reader = response.body!.getReader();
  } catch (err) {
    abort.abort();
    throw err instanceof Error
      ? err
      : new Error('Lobby-Kanal konnte nicht geöffnet werden');
  }

  void (async () => {
    // Continue the already-opened reader, then reconnect loop on drop.
    try {
      const decoder = new TextDecoder();
      let pending = '';
      while (!disposed && reader) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        pending = parseSseReadyChunk(pending, (payload) => {
          if (!disposed) onReady(payload);
        });
      }
    } catch {
      /* fall through to reconnect loop */
    } finally {
      try {
        await reader?.cancel();
      } catch {
        /* ignore */
      }
      reader = null;
    }
    if (!disposed) await pump();
  })();

  return {
    sendReady: async (payload) => {
      if (disposed) return;
      // Server stamps actorId; ignore client-claimed userId for identity.
      await publishHostSessionLobbyReady(sessionId, payload.ready === true);
    },
    unsubscribe: async () => {
      disposed = true;
      abort.abort();
      try {
        await reader?.cancel();
      } catch {
        /* ignore */
      }
    },
  };
}

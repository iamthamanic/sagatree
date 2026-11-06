/**
 * Session media token client — short-lived membership-derived tokens (#363).
 * Location: src/infrastructure/session/media/media-token-client.ts
 *
 * CUT-19: host-first via POST `/api/v1/sessions/:id/media-token` when host library is on.
 * Legacy Edge `session-media-token` remains until dual-path removal (CUT-20).
 */
import { supabase } from '../../../lib/supabase';
import {
  fetchHostSessionMediaToken,
  isHostLibraryEnabled,
} from '../../host/host-session-http';

export type MediaTokenSuccess = {
  readonly ok: true;
  readonly token: string;
  readonly url: string;
  readonly roomId: string;
  readonly expiresAt: string;
  readonly ttlSeconds: number;
};

export type MediaTokenDegraded = {
  readonly ok: false;
  readonly degraded: true;
  readonly reason: 'media_service_unavailable' | 'forbidden' | 'unauthorized' | 'bad_request';
  readonly message: string;
};

export type MediaTokenResult = MediaTokenSuccess | MediaTokenDegraded;

export async function fetchSessionMediaToken(input: {
  sessionId: string;
}): Promise<MediaTokenResult> {
  const sessionId = input.sessionId.trim();
  if (!sessionId) {
    return {
      ok: false,
      degraded: true,
      reason: 'bad_request',
      message: 'sessionId fehlt.',
    };
  }

  if (isHostLibraryEnabled()) {
    return fetchHostSessionMediaToken(sessionId);
  }

  try {
    const { data, error } = await supabase.functions.invoke('session-media-token', {
      body: { sessionId },
    });
    if (error) {
      return {
        ok: false,
        degraded: true,
        reason: 'media_service_unavailable',
        message: error.message || 'Media-Token-Dienst nicht erreichbar.',
      };
    }
    const record = data as Record<string, unknown> | null;
    if (!record || typeof record !== 'object') {
      return {
        ok: false,
        degraded: true,
        reason: 'media_service_unavailable',
        message: 'Leere Media-Token-Antwort.',
      };
    }
    if (record.degraded === true || record.ok === false) {
      const reason =
        record.reason === 'forbidden' ||
        record.reason === 'unauthorized' ||
        record.reason === 'bad_request'
          ? record.reason
          : 'media_service_unavailable';
      return {
        ok: false,
        degraded: true,
        reason,
        message:
          typeof record.message === 'string'
            ? record.message
            : 'Media plane degraded.',
      };
    }
    const token = typeof record.token === 'string' ? record.token : '';
    const url = typeof record.url === 'string' ? record.url : '';
    const roomId = typeof record.roomId === 'string' ? record.roomId : '';
    const expiresAt =
      typeof record.expiresAt === 'string' ? record.expiresAt : '';
    const ttlSeconds =
      typeof record.ttlSeconds === 'number' ? record.ttlSeconds : 0;
    if (!token || !url || !roomId) {
      return {
        ok: false,
        degraded: true,
        reason: 'media_service_unavailable',
        message: 'Media-Token unvollständig.',
      };
    }
    return { ok: true, token, url, roomId, expiresAt, ttlSeconds };
  } catch (error) {
    return {
      ok: false,
      degraded: true,
      reason: 'media_service_unavailable',
      message: error instanceof Error ? error.message : 'Media-Token-Fehler.',
    };
  }
}

/**
 * Session media token client — short-lived membership-derived tokens (#363).
 * Location: src/infrastructure/session/media/media-token-client.ts
 *
 * CUT-20: host-only via POST `/api/v1/sessions/:id/media-token` (no Edge dual-path).
 */
import { fetchHostSessionMediaToken } from '../../host/host-session-http';
import { isHostLibraryEnabled } from '../../host/host-library-http';

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
  if (!isHostLibraryEnabled()) {
    return {
      ok: false,
      degraded: true,
      reason: 'media_service_unavailable',
      message: 'Medien-Dienst nicht erreichbar.',
    };
  }
  return fetchHostSessionMediaToken(sessionId);
}

/**
 * Session media token helpers — grants + room id (Deno + Node testable) (#363).
 * Location: supabase/functions/_shared/session-media-token.ts
 *
 * Pure grant logic duplicated from domain policy (edge cannot import src/).
 * LiveKit JWT minted only when LIVEKIT_API_KEY/SECRET present.
 */

export type EdgeSessionRole = 'player' | 'gamemaster' | 'viewer';

export type EdgeMediaGrant = {
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
  receiveOnly: boolean;
};

export function deriveMediaRoomId(sessionId: string): string {
  return `sagatree-session-${sessionId.trim()}`;
}

export function resolveEdgeMediaGrant(input: {
  role: string;
  capabilities?: string[];
}): EdgeMediaGrant | null {
  const role = input.role.trim().toLowerCase();
  const normalized =
    role === 'gm' ? 'gamemaster' : role === 'observer' ? 'viewer' : role;
  if (
    normalized !== 'player' &&
    normalized !== 'gamemaster' &&
    normalized !== 'viewer'
  ) {
    return null;
  }
  const caps = Array.isArray(input.capabilities) ? input.capabilities : [];
  const isDirector = caps.map((c) => c.toLowerCase()).includes('director');
  const canPublish =
    normalized === 'player' || normalized === 'gamemaster';
  const canSubscribe =
    normalized === 'viewer' ||
    normalized === 'player' ||
    normalized === 'gamemaster' ||
    isDirector;
  return {
    canPublish,
    canSubscribe,
    canPublishData: canPublish,
    receiveOnly: normalized === 'viewer' && !isDirector,
  };
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data),
  );
  return new Uint8Array(sig);
}

/**
 * Minimal LiveKit-compatible access token (HS256).
 * Video grant fields match LiveKit AccessToken video claims.
 */
export async function mintLiveKitAccessToken(input: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  roomName: string;
  ttlSeconds: number;
  grant: EdgeMediaGrant;
}): Promise<{ token: string; expiresAt: string }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + input.ttlSeconds;
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: input.apiKey,
    sub: input.identity,
    nbf: now - 10,
    exp,
    iat: now,
    name: input.identity,
    video: {
      roomJoin: true,
      room: input.roomName,
      canPublish: input.grant.canPublish,
      canSubscribe: input.grant.canSubscribe,
      canPublishData: input.grant.canPublishData,
    },
  };
  const body = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const sig = await hmacSha256(input.apiSecret, body);
  return {
    token: `${body}.${base64Url(sig)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

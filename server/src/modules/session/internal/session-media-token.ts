/**
 * Host characterization of Edge `session-media-token` (MIG-420 / #836).
 * Location: server/src/modules/session/internal/session-media-token.ts
 *
 * Allowlisted Edge worker remains the live mount. Isolated authz / membership /
 * JWT / LiveKit fixtures only. No public activation or production cutover.
 */

/** Explicit: no automatic host/public cutover (successor + MIG-600 still required). */
export const SESSION_MEDIA_TOKEN_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

export const SESSION_MEDIA_TOKEN_DEFAULT_TTL_SECONDS = 120 as const;
export const SESSION_MEDIA_TOKEN_MAX_TTL_SECONDS = 300 as const;
export const SESSION_MEDIA_TOKEN_MIN_TTL_SECONDS = 30 as const;

export type SessionMediaRole = 'player' | 'gamemaster' | 'viewer';

export type SessionMediaGrant = {
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
  receiveOnly: boolean;
};

export type SessionMediaTokenSessionRow = {
  id: string;
  project_id: string;
};

export type SessionMediaTokenMemberRow = {
  user_id: string;
  role: string;
  status: 'active' | 'inactive' | 'invited' | 'removed';
  character_id: string | null;
};

/** Legacy demo table — Edge comment mentions fallback; actual Edge code never reads it. */
export type SessionMediaTokenSessionPlayerRow = {
  session_id: string;
  user_id: string;
  role: string;
};

export type SessionMediaTokenLiveKitConfig = {
  apiKey: string;
  apiSecret: string;
  url: string;
};

export type SessionMediaTokenStore = {
  sessions: Map<string, SessionMediaTokenSessionRow>;
  /** Keyed by `${projectId}::${userId}` for O(1) active-member lookup. */
  projectMembers: Map<string, SessionMediaTokenMemberRow>;
  /** Present only to prove session_players never grants access. */
  sessionPlayers: SessionMediaTokenSessionPlayerRow[];
  livekit: SessionMediaTokenLiveKitConfig | null;
  /** Mirrors missing SUPABASE_URL / SUPABASE_ANON_KEY → 503. */
  supabaseConfigured: boolean;
  /** Mirrors missing SUPABASE_SERVICE_ROLE_KEY → 503. */
  membershipLookupConfigured: boolean;
  /** Diagnostic: no DB writes on success path. */
  writeCount: number;
  /** Diagnostic: outbound LiveKit HTTP calls (Edge signs locally — stays 0). */
  livekitHttpCalls: number;
};

export type SessionMediaTokenDegradedReason =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'media_service_unavailable';

export type SessionMediaTokenSuccess = {
  status: 'ok';
  httpStatus: 200;
  ok: true;
  token: string;
  url: string;
  roomId: string;
  expiresAt: string;
  ttlSeconds: number;
  grant: {
    canPublish: boolean;
    canSubscribe: boolean;
    receiveOnly: boolean;
  };
};

export type SessionMediaTokenError = {
  status: 'error';
  httpStatus: 400 | 401 | 403 | 405 | 503;
  ok: false;
  degraded: true;
  reason: SessionMediaTokenDegradedReason;
  message: string;
  /** Method-not-allowed uses a distinct Edge body shape. */
  methodNotAllowed?: true;
};

export type SessionMediaTokenResult = SessionMediaTokenSuccess | SessionMediaTokenError;

export type SessionMediaTokenIssueInput = {
  userId: string | null;
  method: string;
  body: unknown;
  /** Caller-supplied role/capabilities/room must never influence grants (ignored). */
  clientRole?: unknown;
  clientCapabilities?: unknown;
  clientRoom?: unknown;
};

export function createSessionMediaTokenStore(
  options?: Partial<
    Pick<
      SessionMediaTokenStore,
      | 'livekit'
      | 'supabaseConfigured'
      | 'membershipLookupConfigured'
    >
  >,
): SessionMediaTokenStore {
  return {
    sessions: new Map(),
    projectMembers: new Map(),
    sessionPlayers: [],
    livekit: options?.livekit ?? null,
    // Fail-closed defaults — fixtures / wired hosts must opt in explicitly.
    supabaseConfigured: options?.supabaseConfigured ?? false,
    membershipLookupConfigured: options?.membershipLookupConfigured ?? false,
    writeCount: 0,
    livekitHttpCalls: 0,
  };
}

export function memberKey(projectId: string, userId: string): string {
  return `${projectId}::${userId}`;
}

export function seedSessionMediaTokenSession(
  store: SessionMediaTokenStore,
  row: SessionMediaTokenSessionRow,
): void {
  store.sessions.set(row.id, row);
}

export function seedSessionMediaTokenMember(
  store: SessionMediaTokenStore,
  projectId: string,
  row: SessionMediaTokenMemberRow,
): void {
  store.projectMembers.set(memberKey(projectId, row.user_id), row);
}

export function deriveMediaRoomId(sessionId: string): string {
  return `sagatree-session-${sessionId.trim()}`;
}

export function resolveSessionMediaGrant(input: {
  role: string;
  capabilities?: string[];
}): SessionMediaGrant | null {
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
  const canPublish = normalized === 'player' || normalized === 'gamemaster';
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

/**
 * Clamp TTL to [30, 300]; omitted/non-number → default 120.
 * Non-finite numbers return null (successor hardening — Edge left NaN through
 * to RangeError / exp:null; host rejects instead of throwing).
 */
export function clampSessionMediaTtlSeconds(value: unknown): number | null {
  if (typeof value !== 'number') {
    return SESSION_MEDIA_TOKEN_DEFAULT_TTL_SECONDS;
  }
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.min(
    SESSION_MEDIA_TOKEN_MAX_TTL_SECONDS,
    Math.max(SESSION_MEDIA_TOKEN_MIN_TTL_SECONDS, Math.floor(value)),
  );
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
 * Minimal LiveKit-compatible access token (HS256) — parity with Edge helper.
 */
export async function mintLiveKitAccessToken(input: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  roomName: string;
  ttlSeconds: number;
  grant: SessionMediaGrant;
  nowSeconds?: number;
}): Promise<{ token: string; expiresAt: string; nowSeconds: number }> {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
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
    nowSeconds: now,
  };
}

export type VerifiedLiveKitClaims = {
  iss: string;
  sub: string;
  name: string;
  nbf: number;
  iat: number;
  exp: number;
  room: string;
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
};

function decodeBase64UrlJson(segment: string): unknown {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const b64 = padded + '='.repeat(padLen);
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

/** Verify HS256 LiveKit token for isolated-contract assertions. */
export async function verifyLiveKitAccessToken(
  token: string,
  apiSecret: string,
): Promise<VerifiedLiveKitClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerSeg, payloadSeg, sigSeg] = parts;
  if (!headerSeg || !payloadSeg || !sigSeg) return null;
  const expected = base64Url(await hmacSha256(apiSecret, `${headerSeg}.${payloadSeg}`));
  if (expected !== sigSeg) return null;
  const header = decodeBase64UrlJson(headerSeg) as { alg?: string };
  if (header.alg !== 'HS256') return null;
  const payload = decodeBase64UrlJson(payloadSeg) as {
    iss?: string;
    sub?: string;
    name?: string;
    nbf?: number;
    iat?: number;
    exp?: number;
    video?: {
      room?: string;
      canPublish?: boolean;
      canSubscribe?: boolean;
      canPublishData?: boolean;
    };
  };
  if (
    typeof payload.iss !== 'string' ||
    typeof payload.sub !== 'string' ||
    typeof payload.name !== 'string' ||
    typeof payload.nbf !== 'number' ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    typeof payload.video?.room !== 'string'
  ) {
    return null;
  }
  return {
    iss: payload.iss,
    sub: payload.sub,
    name: payload.name,
    nbf: payload.nbf,
    iat: payload.iat,
    exp: payload.exp,
    room: payload.video.room,
    canPublish: payload.video.canPublish === true,
    canSubscribe: payload.video.canSubscribe === true,
    canPublishData: payload.video.canPublishData === true,
  };
}

function degraded(
  httpStatus: SessionMediaTokenError['httpStatus'],
  reason: SessionMediaTokenDegradedReason,
  message: string,
): SessionMediaTokenError {
  return {
    status: 'error',
    httpStatus,
    ok: false,
    degraded: true,
    reason,
    message,
  };
}

function loadMembership(
  store: SessionMediaTokenStore,
  sessionId: string,
  userId: string,
): { role: string; capabilities: string[] } | null {
  const session = store.sessions.get(sessionId);
  if (!session) return null;
  const member = store.projectMembers.get(memberKey(session.project_id, userId));
  if (!member || member.status !== 'active') return null;
  // Edge loads capabilities as null and treats them as []. Never from client /
  // session_players.
  void store.sessionPlayers;
  return { role: member.role, capabilities: [] };
}

/**
 * Issue a session media token — mirrors Edge handler order (method → config →
 * auth → body → membership → grant → LiveKit → mint).
 */
export async function issueSessionMediaToken(
  store: SessionMediaTokenStore,
  input: SessionMediaTokenIssueInput,
): Promise<SessionMediaTokenResult> {
  // Client-supplied elevation fields are explicitly ignored.
  void input.clientRole;
  void input.clientCapabilities;
  void input.clientRoom;

  if (input.method !== 'POST') {
    return {
      status: 'error',
      httpStatus: 405,
      ok: false,
      degraded: true,
      reason: 'bad_request',
      message: 'Method not allowed',
      methodNotAllowed: true,
    };
  }

  if (!store.supabaseConfigured) {
    return degraded(
      503,
      'media_service_unavailable',
      'Supabase config fehlt.',
    );
  }

  if (!input.userId) {
    return degraded(401, 'unauthorized', 'Authentifizierung erforderlich.');
  }

  const body = input.body;
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return degraded(400, 'bad_request', 'Ungültiger JSON-Body.');
  }
  // Manual runtime validation at the trust boundary (repo has no zod dependency;
  // same field checks as Edge worker — no schema cast of untrusted values into typed DTOs).
  const record = body as Record<string, unknown>;
  const sessionId =
    typeof record.sessionId === 'string' ? record.sessionId.trim() : '';
  if (!sessionId) {
    return degraded(400, 'bad_request', 'sessionId fehlt.');
  }
  if (
    'ttlSeconds' in record &&
    record.ttlSeconds !== undefined &&
    typeof record.ttlSeconds !== 'number'
  ) {
    return degraded(400, 'bad_request', 'Ungültiger ttlSeconds.');
  }

  if (!store.membershipLookupConfigured) {
    return degraded(
      503,
      'media_service_unavailable',
      'Membership lookup nicht konfiguriert.',
    );
  }

  const membership = loadMembership(store, sessionId, input.userId);
  if (!membership) {
    return degraded(
      403,
      'forbidden',
      'Keine aktive Session-Mitgliedschaft.',
    );
  }

  const grant = resolveSessionMediaGrant({
    role: membership.role,
    capabilities: membership.capabilities,
  });
  if (!grant || !grant.canSubscribe) {
    return degraded(
      403,
      'forbidden',
      'Rolle darf Media-Token nicht beziehen.',
    );
  }

  const livekit = store.livekit;
  const apiKey = livekit?.apiKey?.trim() ?? '';
  const apiSecret = livekit?.apiSecret?.trim() ?? '';
  const livekitUrl = livekit?.url?.trim() ?? '';
  if (!apiKey || !apiSecret || !livekitUrl) {
    return degraded(
      503,
      'media_service_unavailable',
      'LiveKit nicht konfiguriert — Session läuft ohne Media Plane weiter.',
    );
  }

  const ttlSeconds = clampSessionMediaTtlSeconds(record.ttlSeconds);
  if (ttlSeconds === null) {
    return degraded(400, 'bad_request', 'Ungültiger ttlSeconds.');
  }
  const roomId = deriveMediaRoomId(sessionId);
  const identity = `user:${input.userId}`;

  const minted = await mintLiveKitAccessToken({
    apiKey,
    apiSecret,
    identity,
    roomName: roomId,
    ttlSeconds,
    grant,
  });

  // Edge signs locally — no outbound LiveKit HTTP; no DB writes.
  return {
    status: 'ok',
    httpStatus: 200,
    ok: true,
    token: minted.token,
    url: livekitUrl,
    roomId,
    expiresAt: minted.expiresAt,
    ttlSeconds,
    grant: {
      canPublish: grant.canPublish,
      canSubscribe: grant.canSubscribe,
      receiveOnly: grant.receiveOnly,
    },
  };
}

/** Documented Edge gaps — host successor hardens TTL; remaining gaps stay required tests. */
export function describeSessionMediaTokenLegacyDefects(): readonly string[] {
  return [
    'No explicit fetch timeout on auth/membership HTTP (Edge; host fixtures are in-memory)',
    'No worker-wide exception normalization for network throws (Edge)',
    'Edge had no finite TTL guard (NaN → RangeError/exp:null); host rejects non-finite with 400',
  ] as const;
}

/** Strip secrets from error-like payloads for SC-06 assertions. */
export function sessionMediaTokenErrorContainsSecrets(
  payload: unknown,
  secrets: readonly string[],
): boolean {
  const text = JSON.stringify(payload ?? {});
  return secrets.some((s) => s.length > 0 && text.includes(s));
}

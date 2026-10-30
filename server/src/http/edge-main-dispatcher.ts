/**
 * Edge `main` dispatcher boundary (MIG-414 / #830) — isolated-contract host port.
 * Location: server/src/http/edge-main-dispatcher.ts
 *
 * Ports resolve/allowlist/JWT gate semantics from supabase/functions/main +
 * _shared/edge-jwt-gate. Does not start Deno userWorkers; public activation stays false
 * until an authorized cutover ticket. Live Edge `main` remains the production mount.
 *
 * Allowlist must stay byte-equal to supabase/functions/_shared/edge-dispatcher-allowlist.ts
 * (enforced by scripts/mig-414-edge-main.self-test.mjs).
 */

/** Explicit product decision: no automatic host/public activation of the dispatcher. */
export const EDGE_MAIN_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

/** Matches EdgeRuntime.userWorkers.create memoryLimitMb in supabase/functions/main. */
export const EDGE_MAIN_WORKER_MEMORY_LIMIT_MB = 512 as const;

/** Matches EdgeRuntime.userWorkers.create workerTimeoutMs (5 * 60 * 1000). */
export const EDGE_MAIN_WORKER_TIMEOUT_MS = 5 * 60 * 1000;

/** Mirror of EDGE_DISPATCHER_ALLOWLIST — keep in sync with Edge shared allowlist. */
export const HOST_EDGE_DISPATCHER_ALLOWLIST = [
  'ai-provider-credentials',
  'character-avatar-meshy',
  'character-lore',
  'item-model3d',
  'item-thumbnail',
  'look-reference-analysis',
  'ollama-settings',
  'session-media-token',
  'session-recap',
] as const;

/** Mirror of EDGE_DISPATCHER_BLOCKED. */
export const HOST_EDGE_DISPATCHER_BLOCKED = new Set(['main', '_shared']);

const ALLOWED = new Set<string>(HOST_EDGE_DISPATCHER_ALLOWLIST);

export const EDGE_MAIN_DISPATCHER_STATUS = Object.freeze({
  kind: 'dispatcher' as const,
  dispatcherAllowed: false as const,
  publicActivationAuthorized: EDGE_MAIN_PUBLIC_ACTIVATION_AUTHORIZED,
  decision: 'Preserve exact dispatch boundary until host cutover.',
});

export type EdgeMainEnv = {
  get(key: string): string | undefined;
};

export type EdgeMainDispatchOk = {
  readonly ok: true;
  readonly serviceName: string;
  readonly workerPathname: string;
  /** Forwarded HTTP method (Edge forwards unchanged). */
  readonly method: string;
  /** Forwarded URL search including `?` (empty string when absent). */
  readonly search: string;
  /** True when a body reference was supplied for unchanged worker forward. */
  readonly bodyForwarded: boolean;
  readonly memoryLimitMb: typeof EDGE_MAIN_WORKER_MEMORY_LIMIT_MB;
  readonly workerTimeoutMs: typeof EDGE_MAIN_WORKER_TIMEOUT_MS;
  /** Isolated-contract: would create worker only after activation authorization. */
  readonly wouldCreateWorker: false;
};

export type EdgeMainDispatchDenied = {
  readonly ok: false;
  readonly status: number;
  readonly body: { readonly error: string };
};

export type EdgeMainDispatchResult = EdgeMainDispatchOk | EdgeMainDispatchDenied;

export function isHostEdgeDispatcherAllowed(serviceName: string): boolean {
  if (!serviceName || serviceName.includes('..')) return false;
  if (HOST_EDGE_DISPATCHER_BLOCKED.has(serviceName)) return false;
  return ALLOWED.has(serviceName);
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = Buffer.from(padded + pad, 'base64');
  return new Uint8Array(binary);
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/** Default on; only explicit false/0/no disables (matches Edge gate). */
export function isJwtVerificationEnabled(env: EdgeMainEnv): boolean {
  const raw = env.get('VERIFY_JWT');
  if (raw === undefined || raw === '') return true;
  const normalized = raw.trim().toLowerCase();
  return normalized !== 'false' && normalized !== '0' && normalized !== 'no';
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(\S+)/i);
  return match?.[1] ?? null;
}

async function verifyHs256(
  token: string,
  secret: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'invalid jwt header' };

  let header: { alg?: string; typ?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0]))) as {
      alg?: string;
      typ?: string;
    };
  } catch {
    return { ok: false, reason: 'invalid jwt header' };
  }
  if (header.alg !== 'HS256') {
    return { ok: false, reason: 'unsupported jwt algorithm' };
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const sig = await crypto.subtle.sign('HMAC', key, data);
  if (bytesToBase64Url(sig) !== parts[2]) {
    return { ok: false, reason: 'invalid jwt' };
  }

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1]))) as {
      exp?: number;
    };
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
      return { ok: false, reason: 'jwt expired' };
    }
  } catch {
    return { ok: false, reason: 'invalid jwt payload' };
  }

  return { ok: true };
}

/**
 * JWT gate for non-OPTIONS. Returns a denied result or null when the request may proceed.
 * Does not require sub/aud/iss — legacy incomplete-claims behavior preserved.
 */
export async function gateEdgeMainJwt(
  method: string,
  authorization: string | null,
  env: EdgeMainEnv,
): Promise<EdgeMainDispatchDenied | null> {
  if (method.toUpperCase() === 'OPTIONS') return null;
  if (!isJwtVerificationEnabled(env)) return null;

  const secret = env.get('JWT_SECRET')?.trim();
  if (!secret) {
    return {
      ok: false,
      status: 500,
      body: { error: 'JWT_SECRET not configured' },
    };
  }

  const token = extractBearerToken(authorization);
  if (!token) {
    return {
      ok: false,
      status: 401,
      body: { error: 'missing Authorization bearer token' },
    };
  }

  const verified = await verifyHs256(token, secret);
  if (!verified.ok) {
    return { ok: false, status: 401, body: { error: verified.reason } };
  }

  return null;
}

/** Resolve worker name from /functions/v1/<name>/… or /<name>/… */
export function resolveEdgeMainServiceName(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  if (segments[0] === 'functions' && segments[1] === 'v1') {
    return segments[2] ?? null;
  }
  return segments[0] ?? null;
}

/** Workers strip `/functions/v1/<name>`; restore that prefix after nginx strip. */
export function toEdgeMainWorkerPathname(pathname: string, serviceName: string): string {
  const segments = pathname.split('/').filter(Boolean);
  let afterService: string[];
  if (segments[0] === 'functions' && segments[1] === 'v1') {
    afterService = segments.slice(3);
  } else {
    afterService = segments.slice(1);
  }
  const suffix = afterService.length > 0 ? `/${afterService.join('/')}` : '';
  return `/functions/v1/${serviceName}${suffix}`;
}

/**
 * Worker-side account authentication after dispatcher JWT acceptance.
 * Anon / service_role / missing `sub` never become an owner actor — Edge workers
 * still authenticate the end-user separately (acceptance Fall 4).
 */
export function evaluatePostDispatcherWorkerAuth(input: {
  readonly jwtPayload: { readonly role?: unknown; readonly sub?: unknown } | null;
}):
  | { readonly ok: true; readonly userId: string }
  | { readonly ok: false; readonly status: 401 | 403; readonly error: string } {
  const payload = input.jwtPayload;
  if (!payload || typeof payload !== 'object') {
    return { ok: false, status: 401, error: 'worker auth requires end-user identity' };
  }
  const role = typeof payload.role === 'string' ? payload.role.trim() : '';
  if (role === 'anon' || role === 'service_role') {
    return {
      ok: false,
      status: 403,
      error: 'dispatcher JWT role is not end-user authorization',
    };
  }
  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  if (!sub) {
    return { ok: false, status: 401, error: 'worker auth requires end-user sub' };
  }
  return { ok: true, userId: sub };
}

/**
 * Pure dispatch decision. Allowed + JWT-ok → wouldCreateWorker:false while activation is denied.
 * Catch path preserves raw Error.message in 500 body (legacy defect characterization).
 */
export async function dispatchEdgeMainRequest(input: {
  readonly method: string;
  readonly pathname: string;
  /** URL search including leading `?`, or empty. */
  readonly search?: string;
  /** Opaque body reference; presence is forwarded, contents not inspected here. */
  readonly body?: unknown;
  readonly authorization?: string | null;
  readonly env: EdgeMainEnv;
}): Promise<EdgeMainDispatchResult> {
  try {
    const method = (input.method || 'GET').toUpperCase();
    const serviceName = resolveEdgeMainServiceName(input.pathname);
    if (!serviceName) {
      return { ok: false, status: 400, body: { error: 'missing function name' } };
    }

    // Fail closed before JWT / worker create — legacy mounts never start.
    if (!isHostEdgeDispatcherAllowed(serviceName)) {
      return { ok: false, status: 404, body: { error: 'Not found' } };
    }

    const jwtDenied = await gateEdgeMainJwt(
      method,
      input.authorization ?? null,
      input.env,
    );
    if (jwtDenied) return jwtDenied;

    const search =
      typeof input.search === 'string' && input.search.length > 0
        ? input.search.startsWith('?')
          ? input.search
          : `?${input.search}`
        : '';

    return {
      ok: true,
      serviceName,
      workerPathname: toEdgeMainWorkerPathname(input.pathname, serviceName),
      method,
      search,
      bodyForwarded: input.body !== undefined,
      memoryLimitMb: EDGE_MAIN_WORKER_MEMORY_LIMIT_MB,
      workerTimeoutMs: EDGE_MAIN_WORKER_TIMEOUT_MS,
      wouldCreateWorker: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status: 500, body: { error: message } };
  }
}

/** Inventoried legacy defects that successors must keep as negative regressions. */
export function describeEdgeMainLegacyDefects(): readonly string[] {
  return [
    'Dispatcher verifies signature and optional exp but not complete JWT claims; worker-side account authentication remains mandatory. Raw exception messages can escape in500 body.',
  ];
}

/**
 * Shared CORS policy for SagaTree Edge Functions.
 * Location: supabase/functions/_shared/cors.ts
 *
 * Single origin/methods policy — functions must not set Access-Control-Allow-Origin locally.
 * Default: allowlist CSV from env (+ localhost when unset). Fail-closed when origin unmatched.
 */

export const DEFAULT_CORS_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';
export const DEFAULT_CORS_ALLOW_HEADERS =
  'authorization, x-client-info, apikey, content-type';

export type CorsOptions = {
  /** Override Allow-Methods (e.g. "POST, OPTIONS" for POST-only functions). */
  methods?: string;
  allowHeaders?: string;
  /**
   * Env keys tried in order for the allowlist CSV (or explicit `*`).
   * Default: CHARACTER_AI_ALLOWED_ORIGIN
   */
  envKeys?: string[];
  /** When true (default), include Content-Type: application/json on CORS header bags. */
  includeJsonContentType?: boolean;
  /**
   * When origin does not match allowlist/localhost:
   * - omit (default): do not set Access-Control-Allow-Origin (fail-closed)
   * - configured-or-star: set configured value or `*` (legacy meshy fallback)
   */
  missingOriginPolicy?: 'omit' | 'configured-or-star';
  /** When true, echo localhost even if an allowlist env is set (legacy meshy). */
  allowLocalhostWhenConfigured?: boolean;
};

function readConfiguredOrigin(envKeys: string[]): string {
  for (const key of envKeys) {
    const value = Deno.env.get(key)?.trim() ?? '';
    if (value) return value;
  }
  return '';
}

export function isLocalDevOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

export function corsHeaders(
  request: Request,
  opts: CorsOptions = {},
): Record<string, string> {
  const envKeys = opts.envKeys?.length
    ? opts.envKeys
    : ['CHARACTER_AI_ALLOWED_ORIGIN'];
  const configured = readConfiguredOrigin(envKeys);
  const requestOrigin = request.headers.get('Origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': opts.methods ?? DEFAULT_CORS_METHODS,
    'Access-Control-Allow-Headers':
      opts.allowHeaders ?? DEFAULT_CORS_ALLOW_HEADERS,
    Vary: 'Origin',
  };

  if (opts.includeJsonContentType !== false) {
    headers['Content-Type'] = 'application/json';
  }

  if (configured === '*') {
    headers['Access-Control-Allow-Origin'] = '*';
    return headers;
  }

  const allowlist = configured
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (requestOrigin && allowlist.includes(requestOrigin)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
    return headers;
  }

  const localhostOk =
    Boolean(requestOrigin) &&
    isLocalDevOrigin(requestOrigin!) &&
    (!configured || opts.allowLocalhostWhenConfigured === true);

  if (localhostOk && requestOrigin) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
    return headers;
  }

  if (opts.missingOriginPolicy === 'configured-or-star') {
    headers['Access-Control-Allow-Origin'] = configured || '*';
  }

  return headers;
}

/** Returns a 204 OPTIONS response, or null if the request is not OPTIONS. */
export function handleOptions(
  request: Request,
  opts?: CorsOptions,
): Response | null {
  if (request.method !== 'OPTIONS') return null;
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, opts),
  });
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
  opts?: CorsOptions,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request, opts),
  });
}

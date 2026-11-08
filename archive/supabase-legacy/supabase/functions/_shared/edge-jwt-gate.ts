/**
 * edge-jwt-gate — Bearer JWT gate for the custom Edge main dispatcher (#607).
 * Location: supabase/functions/_shared/edge-jwt-gate.ts
 *
 * Compose sets VERIFY_JWT (default true). The stock edge-runtime JWT check does
 * not apply when requests are routed through our userWorkers main — this module
 * restores that gate. Opt out only with VERIFY_JWT=false (local debug).
 */

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** Default on; only explicit false/0 disables (matches compose `${VERIFY_JWT:-true}`). */
export function isJwtVerificationEnabled(
  env: { get(key: string): string | undefined } = Deno.env,
): boolean {
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
 * When verification is enabled, require a valid HS256 Bearer JWT (anon / user /
 * service_role). Returns a 401 Response on failure; null when the request may proceed.
 * OPTIONS is always allowed (CORS preflight).
 */
export async function gateEdgeRequestJwt(
  req: Request,
  env: { get(key: string): string | undefined } = Deno.env,
): Promise<Response | null> {
  if (req.method === 'OPTIONS') return null;
  if (!isJwtVerificationEnabled(env)) return null;

  const secret = env.get('JWT_SECRET')?.trim();
  if (!secret) {
    return new Response(JSON.stringify({ error: 'JWT_SECRET not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = extractBearerToken(req.headers.get('Authorization'));
  if (!token) {
    return new Response(JSON.stringify({ error: 'missing Authorization bearer token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const verified = await verifyHs256(token, secret);
  if (!verified.ok) {
    return new Response(JSON.stringify({ error: verified.reason }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null;
}

/**
 * Detect client-forged solo / local-identity claims (GATE-02 common-7 / MIG-015).
 * Location: server/src/auth/solo/forged-identity.ts
 *
 * Solo proof is never an authorization input on remote-facing transports.
 */
import type { IncomingHttpHeaders } from 'node:http';

const FORGED_HEADER_NAMES = [
  'x-solo-user',
  'x-local-identity',
  'x-sagatree-solo-actor',
  'x-sagatree-local-identity',
] as const;

/** Body fields that impersonate solo auth. `soloActorId` on the explicit link route is not auth. */
const FORGED_BODY_KEYS = ['localIdentity', 'soloUser', 'soloIdentity'] as const;

export type ForgedSoloIdentityResult =
  | { forged: false }
  | { forged: true; code: 'SOLO_IDENTITY_FORBIDDEN' };

function headerHasForgedClaim(headers: IncomingHttpHeaders | Headers): boolean {
  if (headers instanceof Headers) {
    for (const name of FORGED_HEADER_NAMES) {
      const value = headers.get(name);
      if (value !== null && String(value).trim().length > 0) return true;
    }
    return false;
  }
  for (const name of FORGED_HEADER_NAMES) {
    const value = headers[name];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.some((item) => String(item).trim().length > 0)) return true;
    } else if (String(value).trim().length > 0) {
      return true;
    }
  }
  return false;
}

function bodyHasForgedClaim(body: unknown): boolean {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return false;
  const record = body as Record<string, unknown>;
  for (const key of FORGED_BODY_KEYS) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) return true;
  }
  return false;
}

/**
 * Fail closed when a client presents solo/local identity as an auth credential.
 * Call on every remote-facing HTTP/WS entry before session resolution.
 */
export function detectForgedSoloIdentityClaims(
  headers: IncomingHttpHeaders | Headers,
  body?: unknown,
): ForgedSoloIdentityResult {
  if (headerHasForgedClaim(headers)) {
    return { forged: true, code: 'SOLO_IDENTITY_FORBIDDEN' };
  }
  if (body !== undefined && bodyHasForgedClaim(body)) {
    return { forged: true, code: 'SOLO_IDENTITY_FORBIDDEN' };
  }
  return { forged: false };
}

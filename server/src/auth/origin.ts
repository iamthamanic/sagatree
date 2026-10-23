/**
 * Origin normalization helpers for cookie-session + credentialed CORS.
 * Location: server/src/auth/origin.ts
 *
 * Browser Origin never includes a trailing slash; compare URL.origin only.
 */

/**
 * Parse a URL or Origin string into a canonical `scheme://host[:port]` form.
 * Returns null when the value is not an absolute http(s) origin.
 */
export function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    // Reject credentials / opaque hosts — origins must be scheme+host+port only.
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * True when `candidate` matches one of the configured trusted origins
 * after normalization. Empty allowlists never match.
 */
export function isTrustedOrigin(
  candidate: string,
  trustedOrigins: readonly string[],
): boolean {
  const normalized = normalizeOrigin(candidate);
  if (!normalized || trustedOrigins.length === 0) return false;
  for (const entry of trustedOrigins) {
    if (entry === normalized) return true;
  }
  return false;
}

/**
 * Normalize a configured trusted-origin list. Invalid entries fail closed
 * (caller must treat null as AUTH_MISCONFIG).
 */
export function normalizeTrustedOrigins(
  raw: readonly string[],
): string[] | null {
  if (raw.length === 0) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const normalized = normalizeOrigin(entry);
    if (!normalized) return null;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out.length > 0 ? out : null;
}

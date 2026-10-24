/**
 * Bundle path/token safety — no traversal into host FS (MIG-502).
 * Location: server/src/migration/bundles/path-safety.ts
 */
const SAFE_TOKEN_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

export function isSafeBundleToken(value: string): boolean {
  return typeof value === 'string' && SAFE_TOKEN_RE.test(value);
}

/** Reject absolute paths, `..`, separators, null bytes. */
export function assertSafeRelativeToken(token: string): { ok: true } | { ok: false; error: string } {
  if (!isSafeBundleToken(token)) {
    return { ok: false, error: 'path-traversal-denied' };
  }
  if (token.includes('\0') || token.includes('/') || token.includes('\\') || token === '..' || token === '.') {
    return { ok: false, error: 'path-traversal-denied' };
  }
  return { ok: true };
}

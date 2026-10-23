/**
 * Solo bind guard — GATE-02 row 7 / PoC common-7 (MIG-015).
 * Location: server/src/auth/solo/bind-guard.ts
 */
export const SOLO_REQUIRES_LOOPBACK = 'SOLO_REQUIRES_LOOPBACK';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.trim().toLowerCase());
}

/**
 * Solo mode must not open a public listener. Returns an error code string or null.
 */
export function assertSoloLoopbackBind(mode: 'solo' | 'remote', host: string): string | null {
  if (mode === 'solo' && !isLoopbackHost(host)) {
    return SOLO_REQUIRES_LOOPBACK;
  }
  return null;
}

/**
 * aiberto-rate-limit — in-memory quota for aiberto-ask (AIB-04).
 * Location: server/src/modules/ai/internal/aiberto-rate-limit.ts
 */
export const AIBERTO_ASK_DEFAULT_RATE_LIMIT = 10;
export const AIBERTO_ASK_RATE_WINDOW_SECONDS = 60;
export const AIBERTO_ASK_MAX_RATE_LIMIT = 60;

export type AibertoRateHit = { count: number; resetAt: number };

export type AibertoRateLimitStore = {
  readonly quota: Map<string, AibertoRateHit>;
};

export function createAibertoRateLimitStore(): AibertoRateLimitStore {
  return { quota: new Map() };
}

export function resolveAibertoAskRateLimit(envLimit?: string | number): number {
  const raw =
    typeof envLimit === 'number'
      ? envLimit
      : Number.parseInt(typeof envLimit === 'string' ? envLimit : '', 10);
  if (!Number.isFinite(raw) || raw < 1) return AIBERTO_ASK_DEFAULT_RATE_LIMIT;
  return Math.min(Math.floor(raw), AIBERTO_ASK_MAX_RATE_LIMIT);
}

export function consumeAibertoAskRateLimit(
  store: AibertoRateLimitStore,
  userId: string,
  limit: number,
  windowSeconds: number = AIBERTO_ASK_RATE_WINDOW_SECONDS,
  nowMs: number = Date.now(),
): { ok: true } | { ok: false; status: 429; message: string } {
  if (!userId.trim()) {
    throw new Error('Rate limit user id is required');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > AIBERTO_ASK_MAX_RATE_LIMIT) {
    throw new Error('Rate limit must be an integer between 1 and 60');
  }
  const existing = store.quota.get(userId);
  if (!existing || existing.resetAt <= nowMs) {
    store.quota.set(userId, { count: 1, resetAt: nowMs + windowSeconds * 1000 });
    return { ok: true };
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      status: 429,
      message: 'Zu viele Aiberto-Anfragen. Bitte warte kurz und versuche es erneut.',
    };
  }
  existing.count += 1;
  return { ok: true };
}

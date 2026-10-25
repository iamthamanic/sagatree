/**
 * In-memory rate limit for look-reference-analysis (MIG-412 / #828).
 * Location: server/src/modules/look/internal/look-reference-rate-limit.ts
 *
 * Process-memory only — resets on restart (legacy characterization).
 */

export type RateLimitHit = { count: number; resetAt: number };

export function createLookReferenceRateLimitStore(): {
  consume: (input: {
    userId: string;
    limit: number;
    windowSeconds: number;
    nowMs?: number;
  }) => { ok: true } | { ok: false; retryAfterSeconds: number };
  /** Test/diagnostic: exposes that quota is memory-only. */
  readonly kind: 'process-memory';
} {
  const hits = new Map<string, RateLimitHit>();
  return {
    kind: 'process-memory',
    consume(input) {
      const now = input.nowMs ?? Date.now();
      const existing = hits.get(input.userId);
      if (!existing || existing.resetAt <= now) {
        hits.set(input.userId, { count: 1, resetAt: now + input.windowSeconds * 1000 });
        return { ok: true };
      }
      if (existing.count >= input.limit) {
        return {
          ok: false,
          retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
        };
      }
      existing.count += 1;
      return { ok: true };
    },
  };
}

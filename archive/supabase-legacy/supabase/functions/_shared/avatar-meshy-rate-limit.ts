/**
 * In-memory rate limit for character-avatar-meshy (#10).
 * Location: supabase/functions/_shared/avatar-meshy-rate-limit.ts
 */

const hits = new Map<string, { count: number; resetAt: number }>();

export function consumeAvatarMeshyRateLimit(input: {
  userId: string;
  limit: number;
  windowSeconds: number;
  nowMs?: number;
}): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = input.nowMs ?? Date.now();
  const key = input.userId;
  const existing = hits.get(key);
  if (!existing || existing.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + input.windowSeconds * 1000 });
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
}

/**
 * Quarantined legacy Edge `ai-gm` worker characterization (MIG-401 / #817).
 * Location: server/src/modules/ai/internal/ai-gm-quarantine.ts
 *
 * NOT a public host route. Legacy worker is dispatcher-unmounted (404).
 * Role-safe NPC projection / lorekeeper+sessions fan-out require explicit successors.
 */

/** Explicit product decision: no automatic host/public activation. */
export const AI_GM_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

/** Default persistent quota window (#670) — override only via env on live Edge. */
export const AI_GM_DEFAULT_RATE_LIMIT = 12 as const;
export const AI_GM_RATE_LIMIT_WINDOW_SECONDS = 60 as const;
export const AI_GM_ACTION_MAX_LENGTH = 5000 as const;

export type AiGmRequestValidation =
  | { readonly valid: true }
  | { readonly valid: false; readonly error: string };

/** Legacy validateRequest shape (sessionId + action string caps). */
export function validateAiGmRequest(body: unknown): AiGmRequestValidation {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }
  const request = body as Record<string, unknown>;
  if (!request.sessionId || typeof request.sessionId !== 'string') {
    return { valid: false, error: 'Missing or invalid sessionId' };
  }
  if (!request.action || typeof request.action !== 'string') {
    return { valid: false, error: 'Missing or invalid action' };
  }
  if (request.action.length > AI_GM_ACTION_MAX_LENGTH) {
    return { valid: false, error: 'Action too long (max 5000 characters)' };
  }
  return { valid: true };
}

/**
 * Ordering contract: membership must run before quota / LLM fan-out.
 * Returns the next stage only when membership allows.
 */
export function aiGmPipelineStageAfterMembership(input: {
  readonly membershipAllowed: boolean;
}): 'denied' | 'rate-limit' {
  return input.membershipAllowed ? 'rate-limit' : 'denied';
}

/** In-memory characterization of consume_ai_gm_rate_limit (default 12/window). */
export type AiGmQuotaBucket = {
  readonly counts: Map<string, number>;
  readonly limit: number;
};

export function createAiGmQuotaBucket(
  limit: number = AI_GM_DEFAULT_RATE_LIMIT,
): AiGmQuotaBucket {
  const safe =
    Number.isInteger(limit) && limit >= 1 && limit <= 60 ? limit : AI_GM_DEFAULT_RATE_LIMIT;
  return { counts: new Map(), limit: safe };
}

/** @returns true when the request is allowed; false → caller should respond 429. */
export function consumeAiGmQuota(bucket: AiGmQuotaBucket, userId: string): boolean {
  const id = typeof userId === 'string' ? userId.trim() : '';
  if (!id) return false;
  const used = bucket.counts.get(id) ?? 0;
  if (used >= bucket.limit) return false;
  bucket.counts.set(id, used + 1);
  return true;
}

export type AiGmStreamChunk =
  | { readonly type: 'narrative'; readonly content: string }
  | {
      readonly type: 'complete';
      readonly narrative: string;
      readonly worldStateUpdate: object | null;
      readonly diceRollsRequired?: readonly unknown[];
      readonly combatInitiated: boolean;
    }
  | { readonly type: 'error'; readonly error: string };

/** Legacy framing: NDJSON lines under Content-Type text/event-stream (not SSE data:). */
export function formatAiGmNdjsonChunk(chunk: AiGmStreamChunk): string {
  return `${JSON.stringify(chunk)}\n`;
}

export const AI_GM_STREAM_CONTENT_TYPE = 'text/event-stream' as const;

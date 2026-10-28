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
/** Max expired keys removed per consume (amortized cleanup; avoids O(U) every call). */
export const AI_GM_QUOTA_SWEEP_BATCH = 8 as const;

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

/** Per-user window entry for consume_ai_gm_rate_limit characterization. */
export type AiGmQuotaEntry = {
  readonly count: number;
  readonly windowStartMs: number;
};

/** In-memory characterization of consume_ai_gm_rate_limit (default 12/window). */
export type AiGmQuotaBucket = {
  readonly entries: Map<string, AiGmQuotaEntry>;
  readonly limit: number;
  readonly windowSeconds: number;
};

export function createAiGmQuotaBucket(
  limit: number = AI_GM_DEFAULT_RATE_LIMIT,
  windowSeconds: number = AI_GM_RATE_LIMIT_WINDOW_SECONDS,
): AiGmQuotaBucket {
  const safeLimit =
    Number.isInteger(limit) && limit >= 1 && limit <= 60 ? limit : AI_GM_DEFAULT_RATE_LIMIT;
  const safeWindow =
    Number.isInteger(windowSeconds) && windowSeconds >= 1 && windowSeconds <= 3600
      ? windowSeconds
      : AI_GM_RATE_LIMIT_WINDOW_SECONDS;
  return { entries: new Map(), limit: safeLimit, windowSeconds: safeWindow };
}

/**
 * @returns true when the request is allowed; false → caller should respond 429.
 * Resets count when `windowSeconds` elapses (injectable `nowMs` for fixtures).
 */
export function consumeAiGmQuota(
  bucket: AiGmQuotaBucket,
  userId: string,
  nowMs: number = Date.now(),
): boolean {
  const id = typeof userId === 'string' ? userId.trim() : '';
  if (!id) return false;
  const windowMs = bucket.windowSeconds * 1000;
  // Bounded sweep: delete up to SWEEP_BATCH expired keys; skip live entries.
  let swept = 0;
  for (const [key, entry] of bucket.entries) {
    if (swept >= AI_GM_QUOTA_SWEEP_BATCH) break;
    if (nowMs - entry.windowStartMs < windowMs) continue;
    bucket.entries.delete(key);
    swept += 1;
  }
  const prior = bucket.entries.get(id);
  const windowStartMs =
    prior !== undefined && nowMs - prior.windowStartMs < windowMs
      ? prior.windowStartMs
      : nowMs;
  const used =
    prior !== undefined && windowStartMs === prior.windowStartMs ? prior.count : 0;
  if (used >= bucket.limit) return false;
  bucket.entries.set(id, { count: used + 1, windowStartMs });
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

/** Concatenate NDJSON chunks (chunk-boundary framing for multi-chunk streams). */
export function formatAiGmNdjsonStream(chunks: readonly AiGmStreamChunk[]): string {
  return chunks.map(formatAiGmNdjsonChunk).join('');
}

/**
 * Split a provider byte stream into NDJSON lines across arbitrary chunk boundaries.
 * Pins line-buffer framing (not SSE `data:`); incomplete trailing lines stay buffered.
 */
export function parseAiGmNdjsonLineBuffer(
  priorBuffer: string,
  incoming: string,
): { readonly lines: readonly string[]; readonly rest: string } {
  const combined = `${priorBuffer}${incoming}`;
  const parts = combined.split('\n');
  const rest = parts.pop() ?? '';
  return { lines: parts.filter((line) => line.length > 0), rest };
}

/** Legacy non-stream JSON body shape (Content-Type application/json). */
export type AiGmNonStreamResponse = {
  readonly narrative: string;
  readonly worldStateUpdate?: object;
  readonly diceRollsRequired?: readonly unknown[];
  readonly combatInitiated: boolean;
};

export function formatAiGmNonStreamResponse(body: AiGmNonStreamResponse): string {
  return JSON.stringify(body);
}

/**
 * Quarantine has no durable AI-GM world-mutation path.
 * Any attempted state write fails closed while public activation stays unauthorized.
 */
export type AiGmStateWriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'activation-denied' | 'no-durable-path' };

export function aiGmAttemptDurableStateWrite(
  _update: object | null,
): AiGmStateWriteResult {
  // Quarantine: public activation stays false → every durable write fails closed.
  void _update;
  void AI_GM_PUBLIC_ACTIVATION_AUTHORIZED;
  return { ok: false, reason: 'activation-denied' };
}

export const AI_GM_STREAM_CONTENT_TYPE = 'text/event-stream' as const;
export const AI_GM_NON_STREAM_CONTENT_TYPE = 'application/json' as const;

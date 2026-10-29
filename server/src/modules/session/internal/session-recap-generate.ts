/**
 * Host characterization of Edge `session-recap` (MIG-421 / #837).
 * Location: server/src/modules/session/internal/session-recap-generate.ts
 *
 * Allowlisted Edge worker remains the live mount. Host ports pin GM-equality
 * authz / body rejection / quota / draft-only persist fixtures. No public activation.
 */

/** Explicit: no automatic host/public cutover (successor + MIG-600 still required). */
export const SESSION_RECAP_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

export const SESSION_RECAP_PROMPT_VERSION = 'episode-summary-v1' as const;
export const SESSION_RECAP_MAX_REQUEST_BYTES = 8_000 as const;
export const SESSION_RECAP_MAX_SUMMARY_LENGTH = 4_000 as const;
export const SESSION_RECAP_DEFAULT_RATE_LIMIT = 6 as const;
export const SESSION_RECAP_MAX_RATE_LIMIT = 60 as const;
export const SESSION_RECAP_RATE_WINDOW_SECONDS = 60 as const;

export type SessionRecapProviderName = 'openai-compatible' | 'ollama';

export type SessionRecapProviderConfig = {
  provider: SessionRecapProviderName;
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export type SessionRecapPromptLine = {
  id: string;
  kind: string;
  summary: string;
  visibility?: string | null;
};

export type SessionRecapPrompt = {
  version: typeof SESSION_RECAP_PROMPT_VERSION;
  system: string;
  user: string;
  eventCount: number;
};

export type SessionRecapSessionRow = {
  id: string;
  name: string;
  status: string;
  project_id: string;
  world_state?: unknown;
};

export type SessionRecapProjectRow = {
  id: string;
  name: string;
  gm_user_id: string;
  /** Owner is never substituted for GM equality. */
  owner_user_id?: string;
};

export type SessionRecapRow = {
  session_id: string;
  snapshot: Record<string, unknown> | null;
  highlight_lines: unknown;
  summary_text: string | null;
  summary_status: 'draft' | 'approved' | 'none' | string | null;
};

type JsonRecord = Record<string, unknown>;
type QuotaEntry = { count: number; resetAt: number };

export type SessionRecapGenerateStore = {
  readonly sessions: Map<string, SessionRecapSessionRow>;
  readonly projects: Map<string, SessionRecapProjectRow>;
  readonly recaps: Map<string, SessionRecapRow>;
  readonly members: Set<string>;
  readonly quota: Map<string, QuotaEntry>;
  /** When false, mirrors missing service-role / RPC → 503 before body validation. */
  persistentStoreAvailable: boolean;
  providerInvocations: number;
  /** Counts sagatree_upsert_session_recap stand-in calls. */
  upsertCount: number;
  /** Counts draft PATCH writes (summary_status=draft). */
  draftPersistCount: number;
  /** Counts any publish/approve transition — must stay 0 for Edge parity. */
  publishCount: number;
  /**
   * When true, the draft PATCH stand-in fails (Edge PATCH non-OK → generic 500).
   * Isolated-contract fixture for persistence-failure acceptance.
   */
  draftPersistFails: boolean;
  /** Captures last prompt lines that reached the provider (for sentinel checks). */
  lastPromptLines: SessionRecapPromptLine[] | null;
  lastProviderPrompt: SessionRecapPrompt | null;
};

export function createSessionRecapGenerateStore(
  persistentStoreAvailable = true,
): SessionRecapGenerateStore {
  return {
    sessions: new Map(),
    projects: new Map(),
    recaps: new Map(),
    members: new Set(),
    quota: new Map(),
    persistentStoreAvailable,
    providerInvocations: 0,
    upsertCount: 0,
    draftPersistCount: 0,
    publishCount: 0,
    draftPersistFails: false,
    lastPromptLines: null,
    lastProviderPrompt: null,
  };
}

export function seedSessionRecapSession(
  store: SessionRecapGenerateStore,
  row: SessionRecapSessionRow,
): void {
  store.sessions.set(row.id, row);
}

export function seedSessionRecapProject(
  store: SessionRecapGenerateStore,
  row: SessionRecapProjectRow,
): void {
  store.projects.set(row.id, row);
}

export function seedSessionRecapMember(
  store: SessionRecapGenerateStore,
  projectId: string,
  userId: string,
): void {
  store.members.add(`${projectId}:${userId}`);
}

export function seedSessionRecapRow(
  store: SessionRecapGenerateStore,
  row: SessionRecapRow,
): void {
  store.recaps.set(row.session_id, {
    ...row,
    snapshot: row.snapshot ? { ...row.snapshot } : null,
  });
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isSessionRecapUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function checkSessionRecapBodySize(
  contentLengthHeader: string | null,
  rawBodyUtf8Bytes?: number,
): { ok: true } | { ok: false; status: 413; message: string } {
  const contentLength = Number.parseInt(contentLengthHeader || '0', 10);
  if (Number.isFinite(contentLength) && contentLength > SESSION_RECAP_MAX_REQUEST_BYTES) {
    return { ok: false, status: 413, message: 'Request body too large' };
  }
  if (
    typeof rawBodyUtf8Bytes === 'number' &&
    rawBodyUtf8Bytes > SESSION_RECAP_MAX_REQUEST_BYTES
  ) {
    return { ok: false, status: 413, message: 'Request body too large' };
  }
  return { ok: true };
}

export function resolveSessionRecapRateLimit(envLimit?: string | number): number {
  const configured =
    typeof envLimit === 'number'
      ? Math.floor(envLimit)
      : Number.parseInt(typeof envLimit === 'string' ? envLimit : '', 10);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, SESSION_RECAP_MAX_RATE_LIMIT)
    : SESSION_RECAP_DEFAULT_RATE_LIMIT;
}

/**
 * Process-memory stand-in for `consume_session_recap_rate_limit` RPC.
 * Charged for every authenticated POST before body/session/GM validation.
 */
export function consumeSessionRecapRateLimit(
  store: SessionRecapGenerateStore,
  userId: string,
  limit: number,
  windowSeconds: number = SESSION_RECAP_RATE_WINDOW_SECONDS,
  nowMs: number = Date.now(),
): { ok: true } | { ok: false; status: 429 | 503; message: string } {
  if (!store.persistentStoreAvailable) {
    return {
      ok: false,
      status: 503,
      message:
        'Session-Recap ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.',
    };
  }
  if (!userId.trim()) {
    throw new Error('Rate limit user id is required');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > SESSION_RECAP_MAX_RATE_LIMIT) {
    throw new Error('Rate limit must be an integer between 1 and 60');
  }
  if (!Number.isInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 3600) {
    throw new Error('Rate limit window must be an integer between 1 and 3600 seconds');
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
      message: 'Zu viele Generierungen. Bitte warte kurz und versuche es erneut.',
    };
  }
  existing.count += 1;
  return { ok: true };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** Prefer SESSION_RECAP_AI_*; fall back to CHARACTER_AI_* / Ollama (Edge parity). */
export function resolveSessionRecapProviderConfig(
  envGet: (key: string) => string | undefined,
): SessionRecapProviderConfig | null {
  const providerValue = (
    envGet('SESSION_RECAP_AI_PROVIDER') ||
    envGet('CHARACTER_AI_PROVIDER') ||
    'ollama'
  ).trim();
  if (providerValue !== 'openai-compatible' && providerValue !== 'ollama') return null;

  const model = (
    envGet('SESSION_RECAP_AI_MODEL') ||
    envGet('CHARACTER_AI_MODEL') ||
    envGet('OLLAMA_MODEL') ||
    ''
  ).trim();
  if (!model) return null;

  if (providerValue === 'openai-compatible') {
    const baseUrl = (
      envGet('SESSION_RECAP_AI_BASE_URL') ||
      envGet('CHARACTER_AI_BASE_URL') ||
      ''
    ).trim();
    const apiKey = (
      envGet('SESSION_RECAP_AI_API_KEY') ||
      envGet('CHARACTER_AI_API_KEY') ||
      ''
    ).trim();
    if (!baseUrl || !apiKey) return null;
    return {
      provider: providerValue,
      baseUrl: trimTrailingSlash(baseUrl),
      model,
      apiKey,
    };
  }

  const baseUrl = (
    envGet('SESSION_RECAP_AI_BASE_URL') ||
    envGet('CHARACTER_AI_BASE_URL') ||
    envGet('OLLAMA_HOST') ||
    ''
  ).trim();
  // Host fail-closed: no Docker-literal hostname. Edge may still default
  // `http://ollama:11434`; missing env here → not-configured / null.
  if (!baseUrl) return null;

  return {
    provider: providerValue,
    baseUrl: trimTrailingSlash(baseUrl),
    model,
  };
}

const FORBIDDEN_VIS = new Set(['gm_only', 'gm-only', 'secret', 'private']);

export function filterSpoilerSafeHighlightLines(
  lines: readonly SessionRecapPromptLine[],
): SessionRecapPromptLine[] {
  return lines.filter((line) => {
    const vis = (line.visibility ?? 'shared').trim().toLowerCase();
    if (FORBIDDEN_VIS.has(vis)) return false;
    if (!line.summary.trim()) return false;
    return true;
  });
}

export function parseHighlightLines(raw: unknown): SessionRecapPromptLine[] {
  if (!Array.isArray(raw)) return [];
  const out: SessionRecapPromptLine[] = [];
  for (const item of raw.slice(0, 40)) {
    if (!isRecord(item)) continue;
    const summary = typeof item.summary === 'string' ? item.summary : '';
    if (!summary.trim()) continue;
    out.push({
      id: typeof item.id === 'string' ? item.id : summary.slice(0, 32),
      kind: typeof item.kind === 'string' ? item.kind : 'generic',
      summary,
      visibility: typeof item.visibility === 'string' ? item.visibility : 'shared',
    });
  }
  return out;
}

export function buildSessionRecapPrompt(input: {
  sessionName: string;
  sagaTitle: string | null;
  highlightLines: readonly SessionRecapPromptLine[];
}): SessionRecapPrompt {
  const safe = filterSpoilerSafeHighlightLines(input.highlightLines).slice(0, 20);
  const saga = (input.sagaTitle ?? '').trim() || 'Saga';
  const session = input.sessionName.trim() || 'Episode';
  const events =
    safe.length === 0
      ? '- (Keine freigegebenen Ereignisse — schreibe eine kurze neutrale Episodennotiz.)'
      : safe.map((l) => `- [${l.kind}] ${l.summary.trim()}`).join('\n');

  return {
    version: SESSION_RECAP_PROMPT_VERSION,
    system:
      'Du bist Spielleiter-Assistent für ein Pen&Paper. Schreibe auf Deutsch eine kurze Episoden-Zusammenfassung (max. 180 Wörter) für Spieler. ' +
      'Nur aus den gelieferten freigegebenen Ereignissen. Keine Spoiler, keine GM-Geheimnisse, keine Erfindung neuer Plot-Twists. ' +
      'Ton: atmosphärisch, klar, ohne Meta (kein „als KI“).',
    user: `Saga: ${saga}\nEpisode: ${session}\n\nFreigegebene Ereignisse:\n${events}\n\nSchreibe die Zusammenfassung als Fließtext.`,
    eventCount: safe.length,
  };
}

export function sessionRecapErrorContainsSecrets(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /sk-[a-z0-9]{10,}/i.test(message) ||
    lower.includes('api_key') ||
    lower.includes('apikey') ||
    lower.includes('service_role') ||
    lower.includes('bearer ')
  );
}

export function stripSessionRecapSecrets(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const safe = { ...payload };
  delete safe.apiKey;
  delete safe.authorization;
  delete safe.SESSION_RECAP_AI_API_KEY;
  delete safe.CHARACTER_AI_API_KEY;
  delete safe.providerSecret;
  delete safe.serviceRoleKey;
  return safe;
}

/**
 * Documented Edge quirks that successors must not treat as approved host policy.
 */
export function describeSessionRecapLegacyDefects(): readonly string[] {
  return [
    'Quota is charged before body/session/GM validation (Edge order); 413 after auth still consumes quota.',
    'No automatic retry of provider generation; publication is a separate RPC decision.',
    'Owner/member/GM-label alone never substitutes for projects.gm_user_id equality.',
  ] as const;
}

export type SessionRecapGenerateResult =
  | {
      readonly status: 'ok';
      readonly summaryText: string;
      readonly summaryStatus: 'draft';
      readonly provider: SessionRecapProviderName;
      readonly model: string;
      readonly promptVersion: string;
      readonly eventCount: number;
      readonly httpStatus: 200;
    }
  | {
      readonly status: 'not-configured';
      readonly message: string;
      readonly httpStatus: 200;
    }
  | {
      readonly status: 'error';
      readonly message: string;
      readonly httpStatus: 400 | 401 | 403 | 404 | 405 | 413 | 429 | 500 | 503;
      readonly reason?: string;
    };

export type SessionRecapGenerateDeps = {
  readonly store: SessionRecapGenerateStore;
  readonly resolveProvider: (
    userId: string,
  ) => SessionRecapProviderConfig | null | Promise<SessionRecapProviderConfig | null>;
  readonly generateSummary: (
    config: SessionRecapProviderConfig,
    prompt: SessionRecapPrompt,
  ) => Promise<string>;
  readonly rateLimitPerMinute?: number;
  readonly nowMs?: number;
};

export type SessionRecapGenerateInput = {
  readonly userId: string | null;
  readonly method?: string;
  readonly contentLengthHeader: string | null;
  readonly rawBodyUtf8Bytes?: number;
  readonly body: unknown;
};

function rejectClientPromptPayload(body: JsonRecord): boolean {
  return (
    body.prompt != null ||
    body.highlights != null ||
    body.adventure != null ||
    body.worldState != null ||
    body.summaryText != null
  );
}

/**
 * Mirror `sagadrive_upsert_session_recap`: snapshot = world_state.shared.adventure.
 * Returns `null` when world_state is absent so callers keep any existing snapshot.
 */
export function deriveAdventureSnapshotFromWorldState(
  worldState: unknown,
): Record<string, unknown> | null {
  if (!isRecord(worldState)) return null;
  const shared = isRecord(worldState.shared) ? worldState.shared : {};
  const adventure = shared.adventure;
  if (!isRecord(adventure)) return {};
  return { ...adventure };
}

/**
 * Isolated generate-recap use-case body.
 * Ordering matches Edge: method → Content-Length → auth → quota → decoded-body →
 * parse → client-payload reject → provider-absent → session/GM → upsert → generate → draft PATCH.
 */
export async function generateSessionRecap(
  deps: SessionRecapGenerateDeps,
  input: SessionRecapGenerateInput,
): Promise<SessionRecapGenerateResult> {
  const method = (input.method ?? 'POST').toUpperCase();
  if (method !== 'POST') {
    return {
      status: 'error',
      message: 'Method not allowed',
      httpStatus: 405,
    };
  }

  const headerSize = checkSessionRecapBodySize(input.contentLengthHeader);
  if (!headerSize.ok) {
    return {
      status: 'error',
      message: headerSize.message,
      httpStatus: headerSize.status,
    };
  }

  const userId = typeof input.userId === 'string' ? input.userId.trim() : '';
  if (!userId) {
    return {
      status: 'error',
      message: 'Authentication required',
      httpStatus: 401,
    };
  }

  const limit = resolveSessionRecapRateLimit(deps.rateLimitPerMinute);
  let rate: { ok: true } | { ok: false; status: 429 | 503; message: string };
  try {
    rate = consumeSessionRecapRateLimit(
      deps.store,
      userId,
      limit,
      SESSION_RECAP_RATE_WINDOW_SECONDS,
      deps.nowMs ?? Date.now(),
    );
  } catch {
    return {
      status: 'error',
      message:
        'Session-Recap ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.',
      httpStatus: 503,
    };
  }
  if (!rate.ok) {
    return { status: 'error', message: rate.message, httpStatus: rate.status };
  }

  // After quota: enforce decoded UTF-8 size. Prefer explicit adapter bytes;
  // otherwise measure the JSON body (covers chunked requests without Content-Length).
  let measuredBytes = input.rawBodyUtf8Bytes;
  if (typeof measuredBytes !== 'number' || !Number.isFinite(measuredBytes)) {
    try {
      measuredBytes = new TextEncoder().encode(JSON.stringify(input.body ?? null)).byteLength;
    } catch {
      measuredBytes = SESSION_RECAP_MAX_REQUEST_BYTES + 1;
    }
  }
  const decodedSize = checkSessionRecapBodySize(null, measuredBytes);
  if (!decodedSize.ok) {
    return {
      status: 'error',
      message: decodedSize.message,
      httpStatus: decodedSize.status,
    };
  }

  if (!isRecord(input.body)) {
    return {
      status: 'error',
      message: 'Ungültige Anfrage.',
      httpStatus: 400,
    };
  }

  const sessionId =
    typeof input.body.sessionId === 'string' ? input.body.sessionId.trim() : '';
  if (!isSessionRecapUuid(sessionId)) {
    return {
      status: 'error',
      message: 'Ungültige Session-ID.',
      httpStatus: 400,
    };
  }

  if (rejectClientPromptPayload(input.body)) {
    return {
      status: 'error',
      message: 'Client-Prompt-Payload ist nicht erlaubt.',
      httpStatus: 400,
    };
  }

  let providerConfig: SessionRecapProviderConfig | null;
  try {
    providerConfig = await deps.resolveProvider(userId);
  } catch {
    return {
      status: 'error',
      message:
        'Session-Recap ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.',
      httpStatus: 503,
    };
  }
  if (!providerConfig) {
    return {
      status: 'not-configured',
      message:
        'Session-Recap-KI ist noch nicht konfiguriert. Hinterlege Provider und Modell unter Einstellungen → AI → Organize oder in der Server-Umgebung.',
      httpStatus: 200,
    };
  }

  try {
    const session = deps.store.sessions.get(sessionId);
    if (!session) {
      return {
        status: 'error',
        message: 'Session nicht gefunden.',
        httpStatus: 404,
      };
    }
    const projectId = session.project_id;
    if (!projectId) {
      return {
        status: 'error',
        message: 'Session ungültig.',
        httpStatus: 400,
      };
    }
    if (session.status !== 'completed' && session.status !== 'cancelled') {
      return {
        status: 'error',
        message: 'Zusammenfassung nur für abgeschlossene Sessions.',
        httpStatus: 400,
      };
    }

    const project = deps.store.projects.get(projectId);
    if (!project) {
      return {
        status: 'error',
        message: 'Saga nicht gefunden.',
        httpStatus: 404,
      };
    }
    // Strict GM equality — owner/member/GM-label alone never substitutes.
    if (project.gm_user_id !== userId) {
      return {
        status: 'error',
        message: 'Nur der Gamemaster darf generieren.',
        httpStatus: 403,
        reason: 'forbidden-not-gm',
      };
    }

    // Mirror sagadrive_upsert_session_recap: snapshot = world_state.shared.adventure.
    // Missing world_state keeps any prior snapshot (do not wipe on provider failure path).
    deps.store.upsertCount += 1;
    const derivedSnapshot = deriveAdventureSnapshotFromWorldState(session.world_state);
    const existingBefore = deps.store.recaps.get(sessionId);
    const snapshot =
      derivedSnapshot !== null
        ? derivedSnapshot
        : existingBefore?.snapshot
          ? { ...existingBefore.snapshot }
          : {};
    const highlightLinesFromAdventure =
      derivedSnapshot !== null
        ? parseHighlightLines(
            Array.isArray(derivedSnapshot.consequences)
              ? derivedSnapshot.consequences
              : [],
          )
        : null;
    deps.store.recaps.set(sessionId, {
      session_id: sessionId,
      snapshot,
      highlight_lines:
        highlightLinesFromAdventure ?? existingBefore?.highlight_lines ?? [],
      summary_text: existingBefore?.summary_text ?? null,
      summary_status: existingBefore?.summary_status ?? 'none',
    });

    const recap = deps.store.recaps.get(sessionId) ?? null;
    const linesFromDb = parseHighlightLines(recap?.highlight_lines);
    const highlightLines = linesFromDb.length
      ? linesFromDb
      : parseHighlightLines(
          Array.isArray(snapshot.consequences) ? snapshot.consequences : [],
        );
    deps.store.lastPromptLines = highlightLines;

    const prompt = buildSessionRecapPrompt({
      sessionName: typeof session.name === 'string' ? session.name : 'Episode',
      sagaTitle: typeof project.name === 'string' ? project.name : null,
      highlightLines,
    });
    deps.store.lastProviderPrompt = prompt;
    deps.store.providerInvocations += 1;

    const summaryRaw = await deps.generateSummary(providerConfig, prompt);
    const summary = typeof summaryRaw === 'string' ? summaryRaw.trim() : '';
    if (!summary || summary.length > SESSION_RECAP_MAX_SUMMARY_LENGTH) {
      throw new Error('Generated summary length is invalid');
    }

    const existing = deps.store.recaps.get(sessionId);
    if (!existing) {
      throw new Error('recap missing after upsert');
    }
    if (deps.store.draftPersistFails) {
      throw new Error('draft persist failed');
    }
    deps.store.recaps.set(sessionId, {
      ...existing,
      summary_text: summary,
      summary_status: 'draft',
    });
    deps.store.draftPersistCount += 1;
    // Publication remains a separate RPC decision — never auto-approve here.

    return {
      status: 'ok',
      summaryText: summary,
      summaryStatus: 'draft',
      provider: providerConfig.provider,
      model: providerConfig.model,
      promptVersion: prompt.version,
      eventCount: prompt.eventCount,
      httpStatus: 200,
    };
  } catch {
    return {
      status: 'error',
      message:
        'Zusammenfassung konnte nicht generiert werden. Du kannst den Text manuell schreiben.',
      httpStatus: 500,
    };
  }
}

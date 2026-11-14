/**
 * text-inference — Host text LLM port for Aiberto (AIB-04). Media AiModality unchanged.
 * Location: server/src/modules/ai/internal/text-inference.ts
 *
 * Reuses Ollama / OpenAI-compatible providers + ollama-url-policy. No second AI stack.
 */
import { assertSafeOllamaBaseUrl, defaultLocalOllamaBase } from './ollama-url-policy.ts';
import { OLLAMA_CLOUD_OPENAI_BASE } from './registry.ts';

export type TextInferenceProviderName = 'openai-compatible' | 'ollama';

export type TextInferenceProviderConfig = {
  readonly provider: TextInferenceProviderName;
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey?: string;
};

export type TextInferenceMessage = {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
};

export type TextInferenceRequest = {
  readonly messages: readonly TextInferenceMessage[];
  readonly temperature?: number;
  readonly signal?: AbortSignal;
};

export type TextInferenceOk = {
  readonly ok: true;
  readonly text: string;
  readonly provider: TextInferenceProviderName;
  readonly model: string;
};

export type TextInferenceErr = {
  readonly ok: false;
  readonly code: 'NOT_CONFIGURED' | 'PROVIDER_UNAVAILABLE' | 'INVALID_RESPONSE' | 'TIMEOUT';
  readonly message: string;
};

export type TextInferenceResult = TextInferenceOk | TextInferenceErr;

export type TextInferenceStreamChunk =
  | { readonly type: 'token'; readonly text: string }
  | { readonly type: 'done'; readonly text: string }
  | {
      readonly type: 'error';
      readonly code: 'NOT_CONFIGURED' | 'PROVIDER_UNAVAILABLE' | 'INVALID_RESPONSE' | 'TIMEOUT';
      readonly message: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * Resolve text provider from AIBERTO_AI_* → CHARACTER_AI_* → OLLAMA_* env (fail-closed).
 */
export function resolveTextInferenceProviderConfig(
  envGet: (key: string) => string | undefined,
): TextInferenceProviderConfig | null {
  const providerValue = (
    envGet('AIBERTO_AI_PROVIDER') ||
    envGet('CHARACTER_AI_PROVIDER') ||
    'ollama'
  ).trim();
  if (providerValue !== 'openai-compatible' && providerValue !== 'ollama') return null;

  const model = (
    envGet('AIBERTO_AI_MODEL') ||
    envGet('CHARACTER_AI_MODEL') ||
    envGet('OLLAMA_MODEL') ||
    ''
  ).trim();
  if (!model) return null;

  if (providerValue === 'openai-compatible') {
    const baseUrl = (
      envGet('AIBERTO_AI_BASE_URL') ||
      envGet('CHARACTER_AI_BASE_URL') ||
      ''
    ).trim();
    const apiKey = (
      envGet('AIBERTO_AI_API_KEY') ||
      envGet('CHARACTER_AI_API_KEY') ||
      ''
    ).trim();
    if (!baseUrl || !apiKey) return null;
    const safe = assertSafeOllamaBaseUrl(baseUrl);
    if (!safe.ok) return null;
    return {
      provider: 'openai-compatible',
      baseUrl: trimTrailingSlash(safe.url),
      model,
      apiKey,
    };
  }

  const baseUrl = (
    envGet('AIBERTO_AI_BASE_URL') ||
    envGet('CHARACTER_AI_BASE_URL') ||
    envGet('OLLAMA_HOST') ||
    ''
  ).trim();
  // Host fail-closed: no Docker-literal default (session-recap parity).
  if (!baseUrl) return null;
  const safe = assertSafeOllamaBaseUrl(baseUrl);
  if (!safe.ok) return null;
  return {
    provider: 'ollama',
    baseUrl: trimTrailingSlash(safe.url.replace(/\/v1\/?$/i, '')),
    model,
  };
}

export function defaultTextInferenceLocalBase(): string {
  return defaultLocalOllamaBase();
}

export function textInferenceCloudOpenAiBase(): string {
  return OLLAMA_CLOUD_OPENAI_BASE;
}

function extractOpenAiContent(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.choices) || value.choices.length === 0) return null;
  const choice = value.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message) || typeof choice.message.content !== 'string') {
    return null;
  }
  return choice.message.content.trim() || null;
}

function extractOllamaContent(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.message) || typeof value.message.content !== 'string') {
    return null;
  }
  return value.message.content.trim() || null;
}

async function inferOpenAiCompatible(
  config: TextInferenceProviderConfig,
  request: TextInferenceRequest,
): Promise<TextInferenceResult> {
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey ?? ''}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: request.temperature ?? 0.2,
        stream: false,
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: request.signal ?? AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Text-Provider antwortet nicht. Bitte später erneut versuchen.',
      };
    }
    const body: unknown = await response.json();
    const text = extractOpenAiContent(body);
    if (!text) {
      return {
        ok: false,
        code: 'INVALID_RESPONSE',
        message: 'Text-Provider lieferte eine ungültige Antwort.',
      };
    }
    return { ok: true, text, provider: config.provider, model: config.model };
  } catch {
    return {
      ok: false,
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Text-Provider ist nicht erreichbar.',
    };
  }
}

async function inferOllama(
  config: TextInferenceProviderConfig,
  request: TextInferenceRequest,
): Promise<TextInferenceResult> {
  try {
    const response = await fetch(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        options: { temperature: request.temperature ?? 0.2 },
      }),
      signal: request.signal ?? AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Text-Provider antwortet nicht. Bitte später erneut versuchen.',
      };
    }
    const body: unknown = await response.json();
    const text = extractOllamaContent(body);
    if (!text) {
      return {
        ok: false,
        code: 'INVALID_RESPONSE',
        message: 'Text-Provider lieferte eine ungültige Antwort.',
      };
    }
    return { ok: true, text, provider: config.provider, model: config.model };
  } catch {
    return {
      ok: false,
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Text-Provider ist nicht erreichbar.',
    };
  }
}

/** Non-streaming text inference (public ai module port). */
export async function inferText(
  config: TextInferenceProviderConfig | null,
  request: TextInferenceRequest,
): Promise<TextInferenceResult> {
  if (!config) {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      message:
        'Text-KI ist noch nicht konfiguriert. Hinterlege Provider/Modell unter Einstellungen → AI oder in der Server-Umgebung.',
    };
  }
  return config.provider === 'openai-compatible'
    ? inferOpenAiCompatible(config, request)
    : inferOllama(config, request);
}

/**
 * Streaming text inference. Yields tokens then a final done chunk with full text.
 * OpenAI-compatible uses SSE; Ollama uses NDJSON stream.
 */
export async function* streamTextInference(
  config: TextInferenceProviderConfig | null,
  request: TextInferenceRequest,
): AsyncGenerator<TextInferenceStreamChunk> {
  if (!config) {
    yield {
      type: 'error',
      code: 'NOT_CONFIGURED',
      message: 'Text-KI ist noch nicht konfiguriert.',
    };
    return;
  }

  if (config.provider === 'openai-compatible') {
    yield* streamOpenAiCompatible(config, request);
    return;
  }
  yield* streamOllama(config, request);
}

async function* streamOpenAiCompatible(
  config: TextInferenceProviderConfig,
  request: TextInferenceRequest,
): AsyncGenerator<TextInferenceStreamChunk> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey ?? ''}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: request.temperature ?? 0.2,
        stream: true,
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: request.signal ?? AbortSignal.timeout(90_000),
    });
  } catch {
    yield {
      type: 'error',
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Text-Provider ist nicht erreichbar.',
    };
    return;
  }
  if (!response.ok || !response.body) {
    yield {
      type: 'error',
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Text-Provider antwortet nicht. Bitte später erneut versuchen.',
    };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let full = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }
        if (!isRecord(parsed) || !Array.isArray(parsed.choices)) continue;
        const choice = parsed.choices[0];
        if (!isRecord(choice) || !isRecord(choice.delta)) continue;
        const piece = typeof choice.delta.content === 'string' ? choice.delta.content : '';
        if (!piece) continue;
        full += piece;
        yield { type: 'token', text: piece };
      }
    }
  } catch {
    yield {
      type: 'error',
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Text-Stream abgebrochen.',
    };
    return;
  }
  yield { type: 'done', text: full };
}

async function* streamOllama(
  config: TextInferenceProviderConfig,
  request: TextInferenceRequest,
): AsyncGenerator<TextInferenceStreamChunk> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        stream: true,
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        options: { temperature: request.temperature ?? 0.2 },
      }),
      signal: request.signal ?? AbortSignal.timeout(90_000),
    });
  } catch {
    yield {
      type: 'error',
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Text-Provider ist nicht erreichbar.',
    };
    return;
  }
  if (!response.ok || !response.body) {
    yield {
      type: 'error',
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Text-Provider antwortet nicht. Bitte später erneut versuchen.',
    };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let full = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          continue;
        }
        if (!isRecord(parsed)) continue;
        if (isRecord(parsed.message) && typeof parsed.message.content === 'string') {
          const piece = parsed.message.content;
          if (piece) {
            // Ollama streaming sends cumulative or delta depending on version; prefer delta when present.
            const delta =
              typeof parsed.message.content === 'string' && parsed.done !== true
                ? piece
                : piece;
            // Many Ollama builds send per-chunk deltas in message.content.
            full += delta;
            yield { type: 'token', text: delta };
          }
        }
      }
    }
  } catch {
    yield {
      type: 'error',
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Text-Stream abgebrochen.',
    };
    return;
  }
  yield { type: 'done', text: full };
}

export function stripTextInferenceSecrets(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const safe = { ...payload };
  delete safe.apiKey;
  delete safe.authorization;
  delete safe.AIBERTO_AI_API_KEY;
  delete safe.CHARACTER_AI_API_KEY;
  delete safe.providerSecret;
  delete safe.serviceRoleKey;
  return safe;
}

export function textInferenceErrorContainsSecrets(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /sk-[a-z0-9]{10,}/i.test(message) ||
    lower.includes('api_key') ||
    lower.includes('apikey') ||
    lower.includes('service_role') ||
    lower.includes('bearer ')
  );
}

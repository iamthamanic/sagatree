/**
 * aiberto-ask-service — FE facade for Host aiberto-ask (AIB-05 / #1128).
 * Location: src/infrastructure/ai/aiberto-ask-service.ts
 *
 * Reuses host cookie auth; streams SSE from POST `/api/v1/ai/aiberto-ask/stream`.
 * No second chat backend — same AIB-04 use-case.
 */
import { getHostAuthBaseUrl } from '../../lib/hostAuthBridge';
import { isHostLibraryEnabled } from '../host/host-library-http';

export type AibertoAskCitation = {
  readonly sectionId: string;
  readonly title?: string;
  readonly number?: string | null;
};

export type AibertoAskFinal =
  | {
      readonly status: 'ok';
      readonly answer: string;
      readonly citations: readonly AibertoAskCitation[];
      readonly droppedCitationIds?: readonly string[];
      readonly indexRevision: string;
      readonly retrievedSectionIds: readonly string[];
      readonly provider?: string;
      readonly model?: string;
    }
  | {
      readonly status: 'unanswered';
      readonly reason: string;
      readonly message: string;
      readonly indexRevision: string;
      readonly retrievedSectionIds: readonly string[];
    }
  | {
      readonly status: 'disabled' | 'not-configured';
      readonly code: string;
      readonly message: string;
    }
  | {
      readonly status: 'error';
      readonly code: string;
      readonly message: string;
      readonly httpStatus?: number;
    };

export type AibertoAskStreamHandlers = {
  readonly onMeta?: (data: Record<string, unknown>) => void;
  readonly onToken?: (text: string) => void;
  readonly onFinal?: (data: AibertoAskFinal) => void;
  readonly onError?: (data: AibertoAskFinal) => void;
};

type EnvLike = {
  readonly VITE_SAGATREE_HOST_AUTH_URL?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function askUrl(env: EnvLike, stream: boolean): string | null {
  const base = getHostAuthBaseUrl(env);
  if (base === null || !isHostLibraryEnabled(env)) return null;
  const path = stream ? '/api/v1/ai/aiberto-ask/stream' : '/api/v1/ai/aiberto-ask';
  return base === '' ? path : `${base}${path}`;
}

function parseFinal(value: unknown): AibertoAskFinal | null {
  if (!isRecord(value) || typeof value.status !== 'string') return null;
  if (value.status === 'ok' && typeof value.answer === 'string') {
    const citations = Array.isArray(value.citations)
      ? value.citations.filter(
          (c): c is AibertoAskCitation =>
            isRecord(c) && typeof c.sectionId === 'string' && c.sectionId.length > 0,
        )
      : [];
    return {
      status: 'ok',
      answer: value.answer,
      citations,
      indexRevision: typeof value.indexRevision === 'string' ? value.indexRevision : '',
      retrievedSectionIds: Array.isArray(value.retrievedSectionIds)
        ? value.retrievedSectionIds.filter((id): id is string => typeof id === 'string')
        : [],
      provider: typeof value.provider === 'string' ? value.provider : undefined,
      model: typeof value.model === 'string' ? value.model : undefined,
    };
  }
  if (value.status === 'unanswered' && typeof value.message === 'string') {
    return {
      status: 'unanswered',
      reason: typeof value.reason === 'string' ? value.reason : 'no-evidence',
      message: value.message,
      indexRevision: typeof value.indexRevision === 'string' ? value.indexRevision : '',
      retrievedSectionIds: Array.isArray(value.retrievedSectionIds)
        ? value.retrievedSectionIds.filter((id): id is string => typeof id === 'string')
        : [],
    };
  }
  if (
    (value.status === 'disabled' || value.status === 'not-configured') &&
    typeof value.message === 'string'
  ) {
    return {
      status: value.status,
      code: typeof value.code === 'string' ? value.code : value.status,
      message: value.message,
    };
  }
  if (value.status === 'error' && typeof value.message === 'string') {
    return {
      status: 'error',
      code: typeof value.code === 'string' ? value.code : 'INTERNAL',
      message: value.message,
      httpStatus: typeof value.httpStatus === 'number' ? value.httpStatus : undefined,
    };
  }
  return null;
}

function parseSseBlocks(buffer: string): { events: { event: string; data: string }[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: { event: string; data: string }[] = [];
  for (const block of parts) {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length > 0) events.push({ event, data: dataLines.join('\n') });
  }
  return { events, rest };
}

export async function streamAibertoAsk(
  question: string,
  handlers: AibertoAskStreamHandlers,
  options?: {
    readonly signal?: AbortSignal;
    readonly fetchImpl?: typeof fetch;
    readonly env?: EnvLike;
  },
): Promise<void> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const env = options?.env ?? ((import.meta as ImportMeta & { env?: EnvLike }).env ?? {});
  const url = askUrl(env, true);
  if (!url) {
    handlers.onError?.({
      status: 'error',
      code: 'HOST_UNAVAILABLE',
      message: 'Aiberto-Host ist nicht erreichbar. Prüfe die Verbindung.',
    });
    return;
  }

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
      signal: options?.signal,
    });
  } catch (err) {
    if (options?.signal?.aborted) return;
    handlers.onError?.({
      status: 'error',
      code: 'HOST_UNAVAILABLE',
      message: 'Aiberto-Host ist nicht erreichbar. Prüfe die Verbindung.',
    });
    return;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.includes('text/event-stream') || !response.body) {
    let fallback: AibertoAskFinal | null = null;
    try {
      const json: unknown = await response.json();
      fallback = parseFinal(json);
    } catch {
      fallback = null;
    }
    handlers.onError?.(
      fallback ?? {
        status: 'error',
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Aiberto-Chat konnte nicht gestartet werden. Bitte später erneut versuchen.',
      },
    );
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseBlocks(pending);
      pending = rest;
      for (const evt of events) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(evt.data);
        } catch {
          continue;
        }
        if (evt.event === 'meta' && isRecord(parsed)) {
          handlers.onMeta?.(parsed);
        } else if (evt.event === 'token' && isRecord(parsed) && typeof parsed.text === 'string') {
          handlers.onToken?.(parsed.text);
        } else if (evt.event === 'final') {
          const final = parseFinal(parsed);
          if (final) handlers.onFinal?.(final);
        } else if (evt.event === 'error') {
          const errFinal = parseFinal(parsed);
          handlers.onError?.(
            errFinal ?? {
              status: 'error',
              code: 'INTERNAL',
              message: 'Aiberto-Stream fehlgeschlagen.',
            },
          );
        }
      }
    }
  } catch (err) {
    if (options?.signal?.aborted) return;
    handlers.onError?.({
      status: 'error',
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Aiberto-Stream abgebrochen. Bitte erneut versuchen.',
    });
  }
}

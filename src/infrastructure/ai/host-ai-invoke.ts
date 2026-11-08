/**
 * host-ai-invoke — Host HTTP transport for infrastructure/ai (CUT-20).
 * Location: src/infrastructure/ai/host-ai-invoke.ts
 *
 * Product runtime: POST `/api/v1/ai/*` on the host — no Edge `functions.invoke`.
 */
import { getHostAuthBaseUrl } from '../../lib/hostAuthBridge';
import { isHostLibraryEnabled } from '../host/host-library-http';

export type AiInvokeFn = (
  path: 'provider-credentials' | 'ollama-settings',
  body: Record<string, unknown>,
) => Promise<unknown>;

type EnvLike = {
  readonly VITE_SAGATREE_HOST_AUTH_URL?: string;
};

type HostAiStatus = 'ok' | 'error' | 'not-configured';

type HostAiEnvelope = {
  readonly status: HostAiStatus;
  readonly message?: string;
  readonly code?: string;
} & Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseHostAiEnvelope(value: unknown): HostAiEnvelope | null {
  if (!isRecord(value) || typeof value.status !== 'string') return null;
  if (value.status !== 'ok' && value.status !== 'error' && value.status !== 'not-configured') {
    return null;
  }
  return value as HostAiEnvelope;
}

async function invokeHost(
  path: 'provider-credentials' | 'ollama-settings',
  body: Record<string, unknown>,
  unreachableMessage: string,
  fetchImpl: typeof fetch,
  env: EnvLike,
): Promise<unknown> {
  const base = getHostAuthBaseUrl(env);
  if (base === null || !isHostLibraryEnabled(env)) {
    throw new Error(unreachableMessage);
  }
  let response: Response;
  try {
    const url = base === '' ? `/api/v1/ai/${path}` : `${base}/api/v1/ai/${path}`;
    response = await fetchImpl(url, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(unreachableMessage);
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(unreachableMessage);
  }
  const envelope = parseHostAiEnvelope(data);
  if (!envelope) throw new Error(unreachableMessage);
  if (!response.ok) {
    return envelope;
  }
  return envelope;
}

/**
 * Host-only invoke used by BYOK + Ollama Organize client facades.
 * Inject `fetchImpl` / `env` in self-tests; production uses defaults.
 */
export function createAiInvoke(options?: {
  readonly fetchImpl?: typeof fetch;
  readonly env?: EnvLike;
}): AiInvokeFn {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const env = options?.env ?? ((import.meta as ImportMeta & { env?: EnvLike }).env ?? {});

  return async (path, body) => {
    return invokeHost(
      path,
      body,
      path === 'ollama-settings'
        ? 'Ollama-Einstellungen nicht erreichbar.'
        : 'AI-Provider-Dienst nicht erreichbar.',
      fetchImpl,
      env,
    );
  };
}

export const defaultAiInvoke = createAiInvoke();

/**
 * host-ai-invoke — dual-path transport for infrastructure/ai (MIG-301 / #800).
 * Location: src/infrastructure/ai/host-ai-invoke.ts
 *
 * When `VITE_SAGATREE_HOST_AUTH_URL` is set, prefer host HTTP adapters.
 * Otherwise keep Edge `supabase.functions.invoke` (no production cutover).
 */
import { supabase } from '../../lib/supabase';
import { getHostAuthBaseUrl } from '../../lib/hostAuthBridge';

export type AiInvokeFn = (path: 'provider-credentials' | 'ollama-settings', body: Record<string, unknown>) => Promise<unknown>;

type EnvLike = { readonly VITE_SAGATREE_HOST_AUTH_URL?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasResponseContext(error: unknown): error is { context: Response } {
  return isRecord(error) && error.context instanceof Response;
}

async function edgeErrorMessage(error: unknown): Promise<string | undefined> {
  if (!hasResponseContext(error)) return undefined;
  try {
    const body: unknown = await error.context.clone().json();
    if (isRecord(body) && typeof body.message === 'string') return body.message;
  } catch {
    return undefined;
  }
  return undefined;
}

async function invokeEdge(
  functionName: 'ai-provider-credentials' | 'ollama-settings',
  body: Record<string, unknown>,
  unreachableMessage: string,
): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) {
    const serverMessage = await edgeErrorMessage(error);
    throw new Error(serverMessage ?? unreachableMessage);
  }
  return data;
}

async function invokeHost(
  path: 'provider-credentials' | 'ollama-settings',
  body: Record<string, unknown>,
  unreachableMessage: string,
  fetchImpl: typeof fetch,
  env: EnvLike,
): Promise<unknown> {
  const base = getHostAuthBaseUrl(env);
  if (!base) throw new Error(unreachableMessage);
  const response = await fetchImpl(`${base}/api/v1/ai/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(unreachableMessage);
  }
  if (!response.ok) {
    const message =
      isRecord(data) && typeof data.message === 'string'
        ? data.message
        : unreachableMessage;
    // Preserve Edge-shaped error objects for client parsers (status/error/not-configured).
    if (isRecord(data) && typeof data.status === 'string') return data;
    throw new Error(message);
  }
  return data;
}

/**
 * Build the dual-path invoke used by BYOK + Ollama Organize client facades.
 * Inject `fetchImpl` / `env` in self-tests; production uses defaults.
 */
export function createAiInvoke(options?: {
  readonly fetchImpl?: typeof fetch;
  readonly env?: EnvLike;
  /** Force Edge even when host URL is set (tests). */
  readonly forceEdge?: boolean;
}): AiInvokeFn {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const env = options?.env ?? ((import.meta as ImportMeta & { env?: EnvLike }).env ?? {});
  const forceEdge = options?.forceEdge === true;

  return async (path, body) => {
    const preferHost = !forceEdge && getHostAuthBaseUrl(env) !== null;
    if (preferHost) {
      return invokeHost(
        path,
        body,
        path === 'ollama-settings'
          ? 'Ollama-Einstellungen nicht erreichbar.'
          : 'AI-Provider-Dienst nicht erreichbar.',
        fetchImpl,
        env,
      );
    }
    return invokeEdge(
      path === 'ollama-settings' ? 'ollama-settings' : 'ai-provider-credentials',
      body,
      path === 'ollama-settings'
        ? 'Ollama-Einstellungen nicht erreichbar.'
        : 'AI-Provider-Dienst nicht erreichbar.',
    );
  };
}

export const defaultAiInvoke = createAiInvoke();

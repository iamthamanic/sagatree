/**
 * ollama-llm-resolve — User Ollama prefs overlay env for LLM Edge callers.
 * Hides local vs cloud + key source. Location: supabase/functions/_shared/ollama-llm-resolve.ts
 */
import {
  decryptProviderSecret,
  parseCredentialsEncryptionKey,
} from './ai-provider-crypto.ts';
import {
  resolveCharacterLoreProviderConfig,
  type CharacterLoreProviderConfig,
} from './character-lore-provider.ts';
import {
  assertSafeOllamaBaseUrl,
  defaultLocalOllamaBase,
  OLLAMA_CLOUD_OPENAI_BASE,
  OLLAMA_PROVIDER_ID,
  toOllamaNativeBase,
} from './ollama-url-policy.ts';

export interface OllamaSettingsView {
  useCloud: boolean;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  keyHint: string | null;
  status: string | null;
  updatedAt: string | null;
  source: 'user' | 'env';
  cloudDefaultUrl: string;
  localDefaultUrl: string;
}

export interface OllamaSettingsStored {
  useCloud: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
  keyHint: string;
  status: string;
  updatedAt: string | null;
  secretCiphertext: string;
}

export interface SupabaseServiceConfig {
  url: string;
  serviceRoleKey: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function envDefaultModel(
  envGet: (key: string) => string | undefined = (k) => Deno.env.get(k),
): string {
  return (envGet('CHARACTER_AI_MODEL') || envGet('OLLAMA_MODEL') || '').trim();
}

export function buildEnvSettingsView(
  envGet: (key: string) => string | undefined = (k) => Deno.env.get(k),
): OllamaSettingsView {
  const envConfig = resolveCharacterLoreProviderConfig();
  const localDefault = defaultLocalOllamaBase(envGet);
  const useCloud =
    envConfig?.provider === 'openai-compatible' &&
    trimTrailingSlash(envConfig.baseUrl).toLowerCase().includes('ollama.com');
  return {
    useCloud,
    baseUrl: envConfig?.baseUrl ?? (useCloud ? OLLAMA_CLOUD_OPENAI_BASE : localDefault),
    model: envConfig?.model ?? envDefaultModel(envGet),
    hasApiKey: Boolean(envConfig?.apiKey),
    keyHint: null,
    status: envConfig ? 'active' : null,
    updatedAt: null,
    source: 'env',
    cloudDefaultUrl: OLLAMA_CLOUD_OPENAI_BASE,
    localDefaultUrl: localDefault,
  };
}

export function prefsToProviderConfig(stored: {
  useCloud: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
}): CharacterLoreProviderConfig | null {
  const model = stored.model.trim();
  if (!model) return null;

  const safe = assertSafeOllamaBaseUrl(stored.baseUrl);
  if (!safe.ok) return null;

  if (stored.useCloud) {
    const apiKey = stored.apiKey.trim();
    if (!apiKey) return null;
    return {
      provider: 'openai-compatible',
      baseUrl: safe.baseUrl,
      model,
      apiKey,
    };
  }

  return {
    provider: 'ollama',
    baseUrl: toOllamaNativeBase(safe.baseUrl),
    model,
    ...(stored.apiKey.trim() ? { apiKey: stored.apiKey.trim() } : {}),
  };
}

export async function loadOllamaSettingsForUser(
  config: SupabaseServiceConfig,
  userId: string,
): Promise<OllamaSettingsStored | null> {
  const url =
    `${config.url}/rest/v1/user_ai_provider_credentials` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&provider_id=eq.${encodeURIComponent(OLLAMA_PROVIDER_ID)}` +
    `&status=eq.active` +
    `&select=secret_ciphertext,key_hint,status,meta,updated_at,added_at` +
    `&limit=1`;

  const response = await fetch(url, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`ollama prefs lookup failed: ${response.status}`);
  }

  const body: unknown = await response.json();
  if (!Array.isArray(body) || body.length === 0 || !isRecord(body[0])) return null;

  const row = body[0];
  const meta = isRecord(row.meta) ? row.meta : {};
  const useCloud = meta.useCloud === true;
  const baseUrl =
    typeof meta.baseUrl === 'string' && meta.baseUrl.trim()
      ? meta.baseUrl.trim()
      : useCloud
        ? OLLAMA_CLOUD_OPENAI_BASE
        : defaultLocalOllamaBase();
  const model = typeof meta.model === 'string' ? meta.model.trim() : '';
  const secretCiphertext =
    typeof row.secret_ciphertext === 'string' ? row.secret_ciphertext : '';
  if (!secretCiphertext) return null;

  const encKey = parseCredentialsEncryptionKey(Deno.env.get('CREDENTIALS_ENCRYPTION_KEY'));
  if (!encKey) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY missing');
  }

  let apiKey = '';
  try {
    apiKey = await decryptProviderSecret(secretCiphertext, encKey);
  } catch {
    throw new Error('OLLAMA_SECRET_DECRYPT');
  }

  return {
    useCloud,
    baseUrl,
    model,
    apiKey,
    keyHint: typeof row.key_hint === 'string' ? row.key_hint : '••••',
    status: typeof row.status === 'string' ? row.status : 'active',
    updatedAt:
      typeof row.updated_at === 'string'
        ? row.updated_at
        : typeof row.added_at === 'string'
          ? row.added_at
          : null,
    secretCiphertext,
  };
}

export function toSettingsView(
  stored: OllamaSettingsStored | null,
  envGet: (key: string) => string | undefined = (k) => Deno.env.get(k),
): OllamaSettingsView {
  const envView = buildEnvSettingsView(envGet);
  if (!stored) return envView;
  return {
    useCloud: stored.useCloud,
    baseUrl: stored.baseUrl,
    model: stored.model,
    hasApiKey: stored.apiKey.trim().length > 0,
    keyHint: stored.apiKey.trim().length > 0 ? stored.keyHint : null,
    status: stored.status,
    updatedAt: stored.updatedAt,
    source: 'user',
    cloudDefaultUrl: OLLAMA_CLOUD_OPENAI_BASE,
    localDefaultUrl: envView.localDefaultUrl,
  };
}

/**
 * Resolve LLM provider: owner prefs first, else env (`CHARACTER_AI_*` / `OLLAMA_*`).
 */
export async function resolveLlmProviderForUser(
  config: SupabaseServiceConfig | null,
  userId: string | null,
): Promise<CharacterLoreProviderConfig | null> {
  if (config && userId) {
    try {
      const stored = await loadOllamaSettingsForUser(config, userId);
      if (stored) {
        const fromPrefs = prefsToProviderConfig(stored);
        if (fromPrefs) return fromPrefs;
      }
    } catch (error) {
      console.error(
        'ollama user prefs resolve failed:',
        error instanceof Error ? error.message : 'unknown',
      );
      // fall through to env
    }
  }
  return resolveCharacterLoreProviderConfig();
}

/**
 * ollama-settings — get/upsert/test/listModels for Organize (Ollama LLM) prefs.
 * Secrets never returned. Location: supabase/functions/ollama-settings/index.ts
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  buildKeyHint,
  encryptProviderSecret,
  parseCredentialsEncryptionKey,
} from '../_shared/ai-provider-crypto.ts';
import {
  buildEnvSettingsView,
  loadOllamaSettingsForUser,
  prefsToProviderConfig,
  toSettingsView,
  type OllamaSettingsView,
} from '../_shared/ollama-llm-resolve.ts';
import {
  assertSafeOllamaBaseUrl,
  defaultLocalOllamaBase,
  OLLAMA_CLOUD_OPENAI_BASE,
  OLLAMA_NONE_SECRET,
  OLLAMA_PROVIDER_ID,
  resolveTagsUrl,
} from '../_shared/ollama-url-policy.ts';
import {
  corsHeaders,
  handleOptions,
  jsonResponse as sharedJsonResponse,
  type CorsOptions,
} from '../_shared/cors.ts';
import { privilegedClientBodyRejectionMessage } from '../_shared/client-trust-body.ts';

type JsonRecord = Record<string, unknown>;

const CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  envKeys: [
    'CHARACTER_AI_ALLOWED_ORIGIN',
    'AI_PROVIDER_ALLOWED_ORIGIN',
    'SESSION_RECAP_AI_ALLOWED_ORIGIN',
  ],
};

interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

const DEFAULT_RATE_LIMIT = 8;
const RATE_WINDOW_SECONDS = 60;
const MAX_MODEL_ID_LEN = 128;
const MAX_API_KEY_LEN = 512;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function jsonResponse(request: Request, body: JsonRecord, status = 200): Response {
  return sharedJsonResponse(request, body, status, CORS_OPTS);
}

function getSupabaseConfig(): SupabaseConfig | null {
  const url = Deno.env.get('SUPABASE_URL')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!url || !anonKey || !serviceRoleKey) return null;
  return { url: url.replace(/\/+$/, ''), anonKey, serviceRoleKey };
}

function getRateLimit(): number {
  const configured = Number.parseInt(
    Deno.env.get('AI_PROVIDER_CREDENTIAL_RATE_LIMIT_PER_MINUTE') || '',
    10,
  );
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, 60)
    : DEFAULT_RATE_LIMIT;
}

async function authenticate(request: Request, config: SupabaseConfig): Promise<string | null> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: config.anonKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const body: unknown = await response.json();
  return isRecord(body) && typeof body.id === 'string' ? body.id : null;
}

async function serviceFetch(
  config: SupabaseConfig,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
}

async function consumeRateLimit(config: SupabaseConfig, userId: string): Promise<boolean> {
  const response = await serviceFetch(
    config,
    '/rest/v1/rpc/consume_ai_provider_credential_rate_limit',
    {
      method: 'POST',
      body: JSON.stringify({
        p_user_id: userId,
        p_limit: getRateLimit(),
        p_window_seconds: RATE_WINDOW_SECONDS,
      }),
    },
  );
  if (!response.ok) {
    console.error('ollama-settings rate limit rpc failed', response.status);
    return false;
  }
  const body: unknown = await response.json();
  return body === true;
}

function viewPayload(view: OllamaSettingsView): JsonRecord {
  return {
    useCloud: view.useCloud,
    baseUrl: view.baseUrl,
    model: view.model,
    hasApiKey: view.hasApiKey,
    keyHint: view.keyHint,
    status: view.status,
    updatedAt: view.updatedAt,
    source: view.source,
    cloudDefaultUrl: view.cloudDefaultUrl,
    localDefaultUrl: view.localDefaultUrl,
  };
}

function parseModelNames(body: unknown): string[] {
  if (!isRecord(body) || !Array.isArray(body.models)) return [];
  const names: string[] = [];
  for (const entry of body.models) {
    if (!isRecord(entry)) continue;
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (name && name.length <= MAX_MODEL_ID_LEN) names.push(name);
  }
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}

async function probeTags(
  useCloud: boolean,
  baseUrl: string,
  apiKey: string,
): Promise<{ ok: true; models: string[] } | { ok: false; message: string }> {
  const tagsUrl = resolveTagsUrl(useCloud, baseUrl);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  let response: Response;
  try {
    response = await fetch(tagsUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return {
      ok: false,
      message: 'Verbindung fehlgeschlagen. Prüfe URL und Erreichbarkeit vom Server.',
    };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, message: 'Authentifizierung fehlgeschlagen. API-Key prüfen.' };
  }
  if (!response.ok) {
    return {
      ok: false,
      message: `Ollama antwortete mit Status ${response.status}.`,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, message: 'Ungültige Antwort von Ollama (/api/tags).' };
  }

  const models = parseModelNames(body);
  return { ok: true, models };
}

serve(async (request: Request) => {
  const optionsResponse = handleOptions(request, CORS_OPTS);
  if (optionsResponse) return optionsResponse;
  if (request.method !== 'POST') {
    return jsonResponse(request, { status: 'error', message: 'Nur POST erlaubt.' }, 405);
  }

  const config = getSupabaseConfig();
  if (!config) {
    return jsonResponse(request, { status: 'error', message: 'Server-Konfiguration fehlt.' }, 500);
  }

  const userId = await authenticate(request, config);
  if (!userId) {
    return jsonResponse(request, { status: 'error', message: 'Nicht angemeldet.' }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { status: 'error', message: 'Ungültiger JSON-Body.' }, 400);
  }
  const privilegedReject = privilegedClientBodyRejectionMessage(body);
  if (privilegedReject) {
    return jsonResponse(request, { status: 'error', message: privilegedReject }, 400);
  }
  if (!isRecord(body) || typeof body.action !== 'string') {
    return jsonResponse(request, { status: 'error', message: 'action fehlt.' }, 400);
  }

  const action = body.action;

  try {
    if (action === 'get') {
      let stored = null;
      try {
        stored = await loadOllamaSettingsForUser(config, userId);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message.includes('CREDENTIALS_ENCRYPTION_KEY')) {
          return jsonResponse(
            request,
            {
              status: 'error',
              message: 'Verschlüsselungsschlüssel fehlt auf dem Server.',
              code: 'encryption-missing',
            },
            503,
          );
        }
        console.error('ollama get failed:', message || 'unknown');
        return jsonResponse(request, {
          status: 'error',
          message: 'Einstellungen konnten nicht geladen werden.',
        }, 500);
      }
      return jsonResponse(request, {
        status: 'ok',
        settings: viewPayload(toSettingsView(stored)),
      });
    }

    if (action === 'upsert' || action === 'test' || action === 'listModels') {
      const allowed = await consumeRateLimit(config, userId);
      if (!allowed) {
        return jsonResponse(
          request,
          {
            status: 'error',
            message: 'Zu viele Anfragen. Bitte kurz warten.',
            code: 'rate-limited',
          },
          429,
        );
      }
    }

    if (action === 'upsert') {
      const useCloud = body.useCloud === true;
      const baseUrlRaw =
        typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '';
      const modelRaw = typeof body.model === 'string' ? body.model.trim() : '';
      const apiKeyRaw =
        typeof body.apiKey === 'string' ? body.apiKey.trim().slice(0, MAX_API_KEY_LEN) : '';

      if (!modelRaw || modelRaw.length > MAX_MODEL_ID_LEN) {
        return jsonResponse(request, {
          status: 'error',
          message: 'Bitte ein gültiges Modell wählen.',
        }, 400);
      }

      const defaultUrl = useCloud ? OLLAMA_CLOUD_OPENAI_BASE : defaultLocalOllamaBase();
      const safe = assertSafeOllamaBaseUrl(baseUrlRaw || defaultUrl);
      if (!safe.ok) {
        return jsonResponse(request, { status: 'error', message: safe.message }, 400);
      }

      let existing = null;
      try {
        existing = await loadOllamaSettingsForUser(config, userId);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message.includes('CREDENTIALS_ENCRYPTION_KEY')) {
          return jsonResponse(
            request,
            {
              status: 'error',
              message: 'Verschlüsselungsschlüssel fehlt auf dem Server.',
              code: 'encryption-missing',
            },
            503,
          );
        }
      }

      const resolvedKey = apiKeyRaw || existing?.apiKey || OLLAMA_NONE_SECRET;
      if (useCloud && !resolvedKey.trim()) {
        return jsonResponse(request, {
          status: 'error',
          message: 'Ollama Cloud benötigt einen API-Key.',
        }, 400);
      }

      const probe = await probeTags(useCloud, safe.baseUrl, resolvedKey);
      if (!probe.ok) {
        return jsonResponse(request, { status: 'error', message: probe.message }, 400);
      }
      if (!probe.models.includes(modelRaw)) {
        return jsonResponse(request, {
          status: 'error',
          message: 'Gewähltes Modell ist auf dem Endpoint nicht verfügbar.',
        }, 400);
      }

      const encKey = parseCredentialsEncryptionKey(Deno.env.get('CREDENTIALS_ENCRYPTION_KEY'));
      if (!encKey) {
        return jsonResponse(
          request,
          {
            status: 'error',
            message: 'Verschlüsselungsschlüssel fehlt auf dem Server.',
            code: 'encryption-missing',
          },
          503,
        );
      }

      const ciphertext = await encryptProviderSecret(resolvedKey, encKey);
      const keyHint = resolvedKey.trim()
        ? buildKeyHint(resolvedKey)
        : '••••none';
      const now = new Date().toISOString();
      const meta = {
        useCloud,
        baseUrl: safe.baseUrl,
        model: modelRaw,
      };

      const upsertRes = await serviceFetch(
        config,
        '/rest/v1/user_ai_provider_credentials?on_conflict=user_id,provider_id',
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify({
            user_id: userId,
            provider_id: OLLAMA_PROVIDER_ID,
            secret_ciphertext: ciphertext,
            key_hint: keyHint,
            status: 'active',
            last_validated_at: now,
            meta,
            updated_at: now,
          }),
        },
      );
      if (!upsertRes.ok) {
        console.error('ollama upsert failed', upsertRes.status);
        return jsonResponse(request, {
          status: 'error',
          message: 'Speichern fehlgeschlagen.',
        }, 500);
      }

      const stored = await loadOllamaSettingsForUser(config, userId);
      return jsonResponse(request, {
        status: 'ok',
        settings: viewPayload(toSettingsView(stored)),
        models: probe.models,
      });
    }

    if (action === 'test' || action === 'listModels') {
      const useCloud = body.useCloud === true;
      const baseUrlRaw =
        typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '';
      const apiKeyRaw =
        typeof body.apiKey === 'string' ? body.apiKey.trim().slice(0, MAX_API_KEY_LEN) : '';

      const defaultUrl = useCloud ? OLLAMA_CLOUD_OPENAI_BASE : defaultLocalOllamaBase();
      const safe = assertSafeOllamaBaseUrl(baseUrlRaw || defaultUrl);
      if (!safe.ok) {
        return jsonResponse(request, { status: 'error', message: safe.message }, 400);
      }

      let existingKey = '';
      try {
        const existing = await loadOllamaSettingsForUser(config, userId);
        existingKey = existing?.apiKey ?? '';
      } catch {
        existingKey = '';
      }
      const resolvedKey = apiKeyRaw || existingKey;

      if (useCloud && !resolvedKey.trim()) {
        return jsonResponse(request, {
          status: 'error',
          message: 'Ollama Cloud benötigt einen API-Key.',
        }, 400);
      }

      // Ensure config would be usable for LLM calls when model present
      if (action === 'test') {
        const modelRaw = typeof body.model === 'string' ? body.model.trim() : '';
        if (modelRaw) {
          const cfg = prefsToProviderConfig({
            useCloud,
            baseUrl: safe.baseUrl,
            model: modelRaw,
            apiKey: resolvedKey,
          });
          if (!cfg) {
            return jsonResponse(request, {
              status: 'error',
              message: 'Konfiguration ist unvollständig.',
            }, 400);
          }
        }
      }

      const probe = await probeTags(useCloud, safe.baseUrl, resolvedKey);
      if (!probe.ok) {
        return jsonResponse(request, { status: 'error', message: probe.message }, 400);
      }

      if (action === 'test') {
        return jsonResponse(request, {
          status: 'ok',
          message: `Verbindung OK — ${probe.models.length} Modell(e) gefunden.`,
          models: probe.models,
          settings: viewPayload({
            ...buildEnvSettingsView(),
            useCloud,
            baseUrl: safe.baseUrl,
            model: typeof body.model === 'string' ? body.model.trim() : '',
            hasApiKey: resolvedKey.trim().length > 0,
            keyHint: null,
            status: 'active',
            updatedAt: null,
            source: 'user',
          }),
        });
      }

      return jsonResponse(request, {
        status: 'ok',
        models: probe.models,
      });
    }

    if (action === 'clear') {
      const allowed = await consumeRateLimit(config, userId);
      if (!allowed) {
        return jsonResponse(
          request,
          {
            status: 'error',
            message: 'Zu viele Anfragen. Bitte kurz warten.',
            code: 'rate-limited',
          },
          429,
        );
      }
      const del = await serviceFetch(
        config,
        `/rest/v1/user_ai_provider_credentials?user_id=eq.${encodeURIComponent(userId)}&provider_id=eq.${encodeURIComponent(OLLAMA_PROVIDER_ID)}`,
        { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
      );
      if (!del.ok) {
        return jsonResponse(request, {
          status: 'error',
          message: 'Zurücksetzen fehlgeschlagen.',
        }, 500);
      }
      return jsonResponse(request, {
        status: 'ok',
        settings: viewPayload(buildEnvSettingsView()),
      });
    }

    return jsonResponse(request, { status: 'error', message: 'Unbekannte action.' }, 400);
  } catch (error) {
    console.error(
      'ollama-settings failed:',
      error instanceof Error ? error.message : 'unknown',
    );
    return jsonResponse(request, {
      status: 'error',
      message: 'Unerwarteter Fehler bei Ollama-Einstellungen.',
    }, 500);
  }
});

/**
 * ai-provider-credentials — list/upsert/refresh/delete user BYOK provider keys.
 * Secrets never returned to the client. Location: supabase/functions/ai-provider-credentials/index.ts
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  buildKeyHint,
  decryptProviderSecret,
  encryptProviderSecret,
  parseCredentialsEncryptionKey,
} from '../_shared/ai-provider-crypto.ts';
import { validateMeshyApiKey } from '../_shared/ai-provider-meshy.ts';
import {
  AI_PROVIDER_CATALOG,
  getProviderDefinition,
  isAiModality,
  listProvidersForModality,
  type AiModality,
} from '../_shared/ai-provider-registry.ts';
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
    'AI_PROVIDER_ALLOWED_ORIGIN',
    'ITEM_MODEL3D_ALLOWED_ORIGIN',
    'ITEM_THUMBNAIL_ALLOWED_ORIGIN',
    'CHARACTER_AI_ALLOWED_ORIGIN',
  ],
};

interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

interface CredentialRow {
  provider_id: string;
  key_hint: string;
  status: string;
  added_at: string;
  last_validated_at: string | null;
  meta: JsonRecord;
  secret_ciphertext?: string;
}

const DEFAULT_RATE_LIMIT = 8;
const RATE_WINDOW_SECONDS = 60;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function getCorsHeaders(request: Request): HeadersInit {
  return corsHeaders(request, CORS_OPTS);
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
    console.error('ai-provider credential rate limit rpc failed', response.status);
    return false;
  }
  const body: unknown = await response.json();
  return body === true;
}

function publicCredentialView(row: CredentialRow, defModalities: readonly string[]) {
  const meta = isRecord(row.meta) ? row.meta : {};
  const credits = typeof meta.credits === 'number' && Number.isFinite(meta.credits)
    ? Math.max(0, Math.round(meta.credits))
    : undefined;
  return {
    providerId: row.provider_id,
    modalities: [...defModalities],
    configured: row.status === 'active',
    keyHint: row.key_hint,
    status: row.status,
    addedAt: row.added_at,
    lastValidatedAt: row.last_validated_at,
    meta: credits === undefined ? {} : { credits },
  };
}

async function listCredentials(
  config: SupabaseConfig,
  userId: string,
): Promise<CredentialRow[]> {
  const response = await serviceFetch(
    config,
    `/rest/v1/user_ai_provider_credentials?user_id=eq.${encodeURIComponent(userId)}&select=provider_id,key_hint,status,added_at,last_validated_at,meta`,
  );
  if (!response.ok) {
    console.error('list credentials failed', response.status);
    return [];
  }
  const body: unknown = await response.json();
  if (!Array.isArray(body)) return [];
  return body.filter((row): row is CredentialRow => {
    return (
      isRecord(row) &&
      typeof row.provider_id === 'string' &&
      typeof row.key_hint === 'string' &&
      typeof row.status === 'string' &&
      typeof row.added_at === 'string'
    );
  }).map((row) => ({
    provider_id: row.provider_id,
    key_hint: row.key_hint,
    status: row.status,
    added_at: row.added_at,
    last_validated_at: typeof row.last_validated_at === 'string' ? row.last_validated_at : null,
    meta: isRecord(row.meta) ? row.meta : {},
  }));
}

async function loadCredentialWithSecret(
  config: SupabaseConfig,
  userId: string,
  providerId: string,
): Promise<CredentialRow | null> {
  const response = await serviceFetch(
    config,
    `/rest/v1/user_ai_provider_credentials?user_id=eq.${encodeURIComponent(userId)}&provider_id=eq.${encodeURIComponent(providerId)}&select=provider_id,key_hint,status,added_at,last_validated_at,meta,secret_ciphertext&limit=1`,
  );
  if (!response.ok) return null;
  const body: unknown = await response.json();
  if (!Array.isArray(body) || body.length === 0 || !isRecord(body[0])) return null;
  const row = body[0];
  if (
    typeof row.provider_id !== 'string' ||
    typeof row.key_hint !== 'string' ||
    typeof row.status !== 'string' ||
    typeof row.added_at !== 'string' ||
    typeof row.secret_ciphertext !== 'string'
  ) {
    return null;
  }
  return {
    provider_id: row.provider_id,
    key_hint: row.key_hint,
    status: row.status,
    added_at: row.added_at,
    last_validated_at: typeof row.last_validated_at === 'string' ? row.last_validated_at : null,
    meta: isRecord(row.meta) ? row.meta : {},
    secret_ciphertext: row.secret_ciphertext,
  };
}

async function validateProviderApiKey(
  providerId: string,
  apiKey: string,
): Promise<{ ok: true; credits?: number } | { ok: false; message: string }> {
  if (providerId === 'meshy') {
    const baseUrl = Deno.env.get('MESHY_API_BASE_URL')?.trim();
    const result = await validateMeshyApiKey(apiKey, { baseUrl });
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, credits: result.credits };
  }
  return { ok: false, message: 'Unbekannter Provider.' };
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
    if (action === 'list') {
      const modalityRaw = typeof body.modality === 'string' ? body.modality : '';
      const modality: AiModality | null = isAiModality(modalityRaw) ? modalityRaw : null;
      const catalog = modality ? listProvidersForModality(modality) : [...AI_PROVIDER_CATALOG];
      const rows = await listCredentials(config, userId);
      const byId = new Map(rows.map((r) => [r.provider_id, r]));

      const providers = catalog.map((def) => {
        const row = byId.get(def.id);
        if (!row) {
          return {
            providerId: def.id,
            displayName: def.displayName,
            modalities: [...def.modalities],
            auth: def.auth,
            docsUrl: def.docsUrl ?? null,
            configured: false,
            keyHint: null,
            status: null,
            addedAt: null,
            lastValidatedAt: null,
            meta: {},
          };
        }
        return {
          displayName: def.displayName,
          auth: def.auth,
          docsUrl: def.docsUrl ?? null,
          ...publicCredentialView(row, def.modalities),
        };
      });

      return jsonResponse(request, {
        status: 'ok',
        modality: modality,
        providers,
      });
    }

    if (action === 'upsert') {
      const providerId = typeof body.providerId === 'string' ? body.providerId.trim() : '';
      const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
      const def = getProviderDefinition(providerId);
      if (!def) {
        return jsonResponse(request, { status: 'error', message: 'Unbekannter Provider.' }, 400);
      }
      if (!apiKey) {
        return jsonResponse(request, { status: 'error', message: 'API-Key fehlt.' }, 400);
      }

      const allowed = await consumeRateLimit(config, userId);
      if (!allowed) {
        return jsonResponse(
          request,
          { status: 'error', message: 'Zu viele Versuche. Bitte kurz warten.', code: 'rate_limited' },
          429,
        );
      }

      const encRaw = parseCredentialsEncryptionKey(Deno.env.get('CREDENTIALS_ENCRYPTION_KEY'));
      if (!encRaw) {
        return jsonResponse(
          request,
          {
            status: 'error',
            message: 'Server-Verschlüsselung nicht konfiguriert (CREDENTIALS_ENCRYPTION_KEY).',
            code: 'not-configured',
          },
          503,
        );
      }

      const validated = await validateProviderApiKey(providerId, apiKey);
      if (!validated.ok) {
        return jsonResponse(request, { status: 'error', message: validated.message }, 400);
      }

      const ciphertext = await encryptProviderSecret(apiKey, encRaw);
      const keyHint = buildKeyHint(apiKey);
      const now = new Date().toISOString();
      const meta: JsonRecord = validated.credits === undefined
        ? {}
        : { credits: validated.credits };

      const existing = await loadCredentialWithSecret(config, userId, providerId);
      let addedAt = existing?.added_at ?? now;
      let upsertResponse: Response;

      if (existing) {
        upsertResponse = await serviceFetch(
          config,
          `/rest/v1/user_ai_provider_credentials?user_id=eq.${encodeURIComponent(userId)}&provider_id=eq.${encodeURIComponent(providerId)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              secret_ciphertext: ciphertext,
              key_hint: keyHint,
              status: 'active',
              last_validated_at: now,
              meta,
              updated_at: now,
            }),
          },
        );
      } else {
        upsertResponse = await serviceFetch(
          config,
          '/rest/v1/user_ai_provider_credentials',
          {
            method: 'POST',
            body: JSON.stringify({
              user_id: userId,
              provider_id: providerId,
              secret_ciphertext: ciphertext,
              key_hint: keyHint,
              status: 'active',
              added_at: now,
              last_validated_at: now,
              meta,
              updated_at: now,
            }),
          },
        );
        addedAt = now;
      }

      if (!upsertResponse.ok) {
        console.error('credential upsert failed', upsertResponse.status);
        return jsonResponse(
          request,
          { status: 'error', message: 'Credential konnte nicht gespeichert werden.' },
          500,
        );
      }

      return jsonResponse(request, {
        status: 'ok',
        provider: {
          displayName: def.displayName,
          auth: def.auth,
          docsUrl: def.docsUrl ?? null,
          ...publicCredentialView(
            {
              provider_id: providerId,
              key_hint: keyHint,
              status: 'active',
              added_at: addedAt,
              last_validated_at: now,
              meta,
            },
            def.modalities,
          ),
        },
      });
    }

    if (action === 'refresh') {
      const providerId = typeof body.providerId === 'string' ? body.providerId.trim() : '';
      const def = getProviderDefinition(providerId);
      if (!def) {
        return jsonResponse(request, { status: 'error', message: 'Unbekannter Provider.' }, 400);
      }

      const allowed = await consumeRateLimit(config, userId);
      if (!allowed) {
        return jsonResponse(
          request,
          { status: 'error', message: 'Zu viele Versuche. Bitte kurz warten.', code: 'rate_limited' },
          429,
        );
      }

      const encRaw = parseCredentialsEncryptionKey(Deno.env.get('CREDENTIALS_ENCRYPTION_KEY'));
      if (!encRaw) {
        return jsonResponse(
          request,
          {
            status: 'error',
            message: 'Server-Verschlüsselung nicht konfiguriert (CREDENTIALS_ENCRYPTION_KEY).',
            code: 'not-configured',
          },
          503,
        );
      }

      const row = await loadCredentialWithSecret(config, userId, providerId);
      if (!row?.secret_ciphertext) {
        return jsonResponse(
          request,
          { status: 'error', message: 'Kein gespeicherter Key für diesen Provider.' },
          404,
        );
      }

      let apiKey: string;
      try {
        apiKey = await decryptProviderSecret(row.secret_ciphertext, encRaw);
      } catch {
        return jsonResponse(
          request,
          { status: 'error', message: 'Gespeicherter Key konnte nicht entschlüsselt werden.' },
          500,
        );
      }

      const validated = await validateProviderApiKey(providerId, apiKey);
      if (!validated.ok) {
        await serviceFetch(
          config,
          `/rest/v1/user_ai_provider_credentials?user_id=eq.${encodeURIComponent(userId)}&provider_id=eq.${encodeURIComponent(providerId)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'invalid',
              updated_at: new Date().toISOString(),
            }),
          },
        );
        return jsonResponse(request, { status: 'error', message: validated.message }, 400);
      }

      const now = new Date().toISOString();
      const meta: JsonRecord = validated.credits === undefined
        ? row.meta
        : { ...row.meta, credits: validated.credits };

      await serviceFetch(
        config,
        `/rest/v1/user_ai_provider_credentials?user_id=eq.${encodeURIComponent(userId)}&provider_id=eq.${encodeURIComponent(providerId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'active',
            last_validated_at: now,
            meta,
            updated_at: now,
          }),
        },
      );

      return jsonResponse(request, {
        status: 'ok',
        provider: {
          displayName: def.displayName,
          auth: def.auth,
          docsUrl: def.docsUrl ?? null,
          ...publicCredentialView(
            {
              ...row,
              status: 'active',
              last_validated_at: now,
              meta,
            },
            def.modalities,
          ),
        },
      });
    }

    if (action === 'delete') {
      const providerId = typeof body.providerId === 'string' ? body.providerId.trim() : '';
      if (!getProviderDefinition(providerId)) {
        return jsonResponse(request, { status: 'error', message: 'Unbekannter Provider.' }, 400);
      }

      const deleteResponse = await serviceFetch(
        config,
        `/rest/v1/user_ai_provider_credentials?user_id=eq.${encodeURIComponent(userId)}&provider_id=eq.${encodeURIComponent(providerId)}`,
        { method: 'DELETE' },
      );
      if (!deleteResponse.ok) {
        console.error('credential delete failed', deleteResponse.status);
        return jsonResponse(
          request,
          { status: 'error', message: 'Credential konnte nicht gelöscht werden.' },
          500,
        );
      }

      return jsonResponse(request, { status: 'ok', providerId });
    }

    return jsonResponse(request, { status: 'error', message: 'Unbekannte action.' }, 400);
  } catch (error) {
    console.error(
      'ai-provider-credentials failed',
      error instanceof Error ? error.message : 'unknown',
    );
    return jsonResponse(request, { status: 'error', message: 'Unerwarteter Serverfehler.' }, 500);
  }
});

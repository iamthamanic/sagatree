/**
 * ai module public API — BYOK credentials + Ollama prefs (MIG-402 / #818).
 * Location: server/src/modules/ai/index.ts
 */
import type { Actor } from '../identity/index.ts';
import type { HostDatabase } from '../../persistence/open-database.ts';
import { CredentialStore } from './internal/credential-store.ts';
import {
  buildKeyHint,
  decryptProviderSecret,
  encryptProviderSecret,
  parseCredentialsEncryptionKey,
} from './internal/crypto.ts';
import {
  AI_PROVIDER_CATALOG,
  getProviderDefinition,
  isAiModality,
  listProvidersForModality,
  looksLikeMeshyApiKey,
  OLLAMA_CLOUD_OPENAI_BASE,
  OLLAMA_NONE_SECRET,
  OLLAMA_PROVIDER_ID,
  type AiModality,
} from './internal/registry.ts';
import { assertSafeOllamaBaseUrl, defaultLocalOllamaBase } from './internal/ollama-url-policy.ts';

export type AiResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly status: number; readonly code?: string };

export type ProviderPublicView = {
  readonly providerId: string;
  readonly displayName: string;
  readonly modalities: readonly string[];
  readonly auth: string;
  readonly docsUrl: string | null;
  readonly configured: boolean;
  readonly keyHint: string | null;
  readonly status: string | null;
  readonly addedAt: string | null;
  readonly lastValidatedAt: string | null;
  readonly meta: { readonly credits?: number };
};

export type OllamaSettingsView = {
  readonly useCloud: boolean;
  readonly baseUrl: string;
  readonly model: string;
  readonly hasApiKey: boolean;
  readonly keyHint: string | null;
  readonly status: string | null;
  readonly updatedAt: string | null;
  readonly source: 'user' | 'env';
  readonly cloudDefaultUrl: string;
  readonly localDefaultUrl: string;
};

export type ValidateProviderFn = (
  providerId: string,
  apiKey: string,
) => Promise<{ ok: true; credits?: number } | { ok: false; message: string }>;

export type FetchModelsFn = (
  baseUrl: string,
  apiKey: string | null,
) => Promise<{ ok: true; models: readonly string[] } | { ok: false; message: string }>;

const DEFAULT_RATE_LIMIT = 8;
const RATE_WINDOW_SECONDS = 60;

function actorUserId(actor: Actor): string | null {
  return actor?.actorId ? actor.actorId : null;
}

type EnvMap = Record<string, string | undefined>;

function getRateLimit(env: EnvMap): number {
  const configured = Number.parseInt(env.AI_PROVIDER_CREDENTIAL_RATE_LIMIT_PER_MINUTE || '', 10);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, 60)
    : DEFAULT_RATE_LIMIT;
}

function publicCredits(meta: Record<string, unknown>): { credits?: number } {
  const credits = typeof meta.credits === 'number' && Number.isFinite(meta.credits)
    ? Math.max(0, Math.round(meta.credits))
    : undefined;
  return credits === undefined ? {} : { credits };
}

export type AiPorts = {
  readonly moduleId: 'ai';
  readonly store: CredentialStore;
  readonly listCredentials: (
    actor: Actor,
    modality?: string | null,
  ) => Promise<AiResult<{ status: 'ok'; modality: AiModality | null; providers: ProviderPublicView[] }>>;
  readonly upsertCredential: (
    actor: Actor,
    providerId: string,
    apiKey: string,
  ) => Promise<AiResult<{ status: 'ok'; provider: ProviderPublicView }>>;
  readonly refreshCredential: (
    actor: Actor,
    providerId: string,
  ) => Promise<AiResult<{ status: 'ok'; provider: ProviderPublicView }>>;
  readonly deleteCredential: (
    actor: Actor,
    providerId: string,
  ) => Promise<AiResult<{ status: 'ok'; providerId: string }>>;
  readonly getOllamaSettings: (actor: Actor) => Promise<AiResult<{ status: 'ok'; settings: OllamaSettingsView }>>;
  readonly upsertOllamaSettings: (
    actor: Actor,
    input: { useCloud: boolean; baseUrl: string; model: string; apiKey?: string },
  ) => Promise<AiResult<{ status: 'ok'; settings: OllamaSettingsView; models: readonly string[] }>>;
  readonly testOllamaSettings: (
    actor: Actor,
    input?: { useCloud?: boolean; baseUrl?: string; model?: string; apiKey?: string },
  ) => Promise<AiResult<{ status: 'ok'; ok: true; message: string; models: readonly string[] }>>;
  readonly listOllamaModels: (
    actor: Actor,
    input?: { useCloud?: boolean; baseUrl?: string; apiKey?: string },
  ) => Promise<AiResult<{ status: 'ok'; models: readonly string[] }>>;
  readonly clearOllamaSettings: (
    actor: Actor,
  ) => Promise<AiResult<{ status: 'ok'; settings: OllamaSettingsView }>>;
};

export function createAiPorts(deps: {
  readonly db: HostDatabase;
  readonly env?: EnvMap;
  readonly validateProvider?: ValidateProviderFn;
  readonly fetchModels?: FetchModelsFn;
}): AiPorts {
  const env: EnvMap = deps.env ?? process.env;
  const store = new CredentialStore(deps.db);
  const validateProvider: ValidateProviderFn =
    deps.validateProvider ??
    (async (providerId, apiKey) => {
      if (providerId !== 'meshy') return { ok: false, message: 'Unbekannter Provider.' };
      if (!looksLikeMeshyApiKey(apiKey)) {
        return { ok: false, message: 'Ungültiges Meshy-API-Key-Format (erwartet msy_…).' };
      }
      // Default host path refuses live outbound unless a validate hook is injected (isolated-contract).
      return { ok: false, message: 'Meshy-Validierung nicht konfiguriert.' };
    });
  const fetchModels: FetchModelsFn =
    deps.fetchModels ??
    (async () => ({ ok: false, message: 'Model-Liste nicht konfiguriert.' }));

  function encKey() {
    return parseCredentialsEncryptionKey(env.CREDENTIALS_ENCRYPTION_KEY);
  }

  async function toProviderView(
    def: { id: string; displayName: string; modalities: readonly string[]; auth: string; docsUrl?: string },
    row: ReturnType<CredentialStore['loadWithSecret']>,
  ): Promise<ProviderPublicView> {
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
      providerId: row.providerId,
      displayName: def.displayName,
      modalities: [...def.modalities],
      auth: def.auth,
      docsUrl: def.docsUrl ?? null,
      configured: row.status === 'active',
      keyHint: row.keyHint,
      status: row.status,
      addedAt: row.addedAt,
      lastValidatedAt: row.lastValidatedAt,
      meta: publicCredits(row.meta),
    };
  }

  async function ollamaView(userId: string): Promise<OllamaSettingsView> {
    const row = store.loadWithSecret(userId, OLLAMA_PROVIDER_ID);
    const localDefaultUrl = defaultLocalOllamaBase();
    if (!row) {
      return {
        useCloud: false,
        baseUrl: localDefaultUrl,
        model: '',
        hasApiKey: false,
        keyHint: null,
        status: null,
        updatedAt: null,
        source: 'env',
        cloudDefaultUrl: OLLAMA_CLOUD_OPENAI_BASE,
        localDefaultUrl,
      };
    }
    const meta = row.meta;
    const useCloud = meta.useCloud === true;
    const baseUrl =
      typeof meta.baseUrl === 'string' && meta.baseUrl
        ? meta.baseUrl
        : useCloud
          ? OLLAMA_CLOUD_OPENAI_BASE
          : localDefaultUrl;
    const model = typeof meta.model === 'string' ? meta.model : '';
    const hasApiKey = Boolean(row.secretCiphertext) && row.secretCiphertext !== OLLAMA_NONE_SECRET;
    return {
      useCloud,
      baseUrl,
      model,
      hasApiKey,
      keyHint: hasApiKey ? row.keyHint : null,
      status: row.status,
      updatedAt: row.lastValidatedAt ?? row.addedAt,
      source: 'user',
      cloudDefaultUrl: OLLAMA_CLOUD_OPENAI_BASE,
      localDefaultUrl,
    };
  }

  return {
    moduleId: 'ai',
    store,

    async listCredentials(actor, modalityRaw) {
      const userId = actorUserId(actor);
      if (!userId) return { ok: false, error: 'Nicht angemeldet.', status: 401 };
      const modality = typeof modalityRaw === 'string' && isAiModality(modalityRaw) ? modalityRaw : null;
      const catalog = modality ? listProvidersForModality(modality) : [...AI_PROVIDER_CATALOG];
      const listed = store.listPublic(userId);
      // Successor decision (legacy emptied on DB error): fail closed with 500 — never silent empty PASS.
      if (!Array.isArray(listed)) {
        return { ok: false, error: 'Credential-Liste nicht lesbar.', status: 500, code: 'db_error' };
      }
      const byId = new Map(listed.map((r) => [r.providerId, r]));
      const providers: ProviderPublicView[] = [];
      for (const def of catalog) {
        providers.push(await toProviderView(def, byId.get(def.id) ?? null));
      }
      return { ok: true, value: { status: 'ok', modality, providers } };
    },

    async upsertCredential(actor, providerIdRaw, apiKeyRaw) {
      const userId = actorUserId(actor);
      if (!userId) return { ok: false, error: 'Nicht angemeldet.', status: 401 };
      const providerId = providerIdRaw.trim();
      const apiKey = apiKeyRaw.trim();
      const def = getProviderDefinition(providerId);
      if (!def) return { ok: false, error: 'Unbekannter Provider.', status: 400 };
      if (!apiKey) return { ok: false, error: 'API-Key fehlt.', status: 400 };

      if (!store.consumeRateLimit(userId, getRateLimit(env), RATE_WINDOW_SECONDS)) {
        return {
          ok: false,
          error: 'Zu viele Versuche. Bitte kurz warten.',
          status: 429,
          code: 'rate_limited',
        };
      }

      const encRaw = encKey();
      if (!encRaw) {
        return {
          ok: false,
          error: 'Server-Verschlüsselung nicht konfiguriert (CREDENTIALS_ENCRYPTION_KEY).',
          status: 503,
          code: 'not-configured',
        };
      }

      // Shape check before outbound validate (quota already charged).
      if (providerId === 'meshy' && !looksLikeMeshyApiKey(apiKey)) {
        return { ok: false, error: 'Ungültiges Meshy-API-Key-Format (erwartet msy_…).', status: 400 };
      }

      const validated = await validateProvider(providerId, apiKey);
      if (!validated.ok) return { ok: false, error: validated.message, status: 400 };

      const ciphertext = await encryptProviderSecret(apiKey, encRaw);
      const keyHint = buildKeyHint(apiKey);
      const meta = validated.credits === undefined ? {} : { credits: validated.credits };
      const saved = store.upsert({
        userId,
        providerId,
        secretCiphertext: ciphertext,
        keyHint,
        status: 'active',
        meta,
      });
      if (!saved.ok) {
        return { ok: false, error: 'Credential konnte nicht gespeichert werden.', status: 500 };
      }
      const row = store.loadWithSecret(userId, providerId);
      const provider = await toProviderView(def, row);
      return { ok: true, value: { status: 'ok', provider } };
    },

    async refreshCredential(actor, providerIdRaw) {
      const userId = actorUserId(actor);
      if (!userId) return { ok: false, error: 'Nicht angemeldet.', status: 401 };
      const providerId = providerIdRaw.trim();
      const def = getProviderDefinition(providerId);
      if (!def) return { ok: false, error: 'Unbekannter Provider.', status: 400 };

      if (!store.consumeRateLimit(userId, getRateLimit(env), RATE_WINDOW_SECONDS)) {
        return {
          ok: false,
          error: 'Zu viele Versuche. Bitte kurz warten.',
          status: 429,
          code: 'rate_limited',
        };
      }

      const encRaw = encKey();
      if (!encRaw) {
        return {
          ok: false,
          error: 'Server-Verschlüsselung nicht konfiguriert (CREDENTIALS_ENCRYPTION_KEY).',
          status: 503,
          code: 'not-configured',
        };
      }

      const existing = store.loadWithSecret(userId, providerId);
      if (!existing?.secretCiphertext) {
        return { ok: false, error: 'Kein gespeicherter Key.', status: 404 };
      }

      let plaintext: string;
      try {
        plaintext = await decryptProviderSecret(existing.secretCiphertext, encRaw);
      } catch {
        return { ok: false, error: 'Entschlüsselung fehlgeschlagen.', status: 500 };
      }

      const validated = await validateProvider(providerId, plaintext);
      const nowMeta = validated.ok && validated.credits !== undefined
        ? { credits: validated.credits }
        : existing.meta;
      const status = validated.ok ? 'active' : 'invalid';
      const patched = store.patchMeta({
        userId,
        providerId,
        status,
        meta: nowMeta,
      });
      // Successor decision: persistence failure is an explicit error (legacy ignored PATCH).
      if (!patched.ok) {
        return {
          ok: false,
          error: 'Refresh konnte nicht gespeichert werden.',
          status: 500,
          code: 'persist_failed',
        };
      }
      if (!validated.ok) {
        return { ok: false, error: validated.message, status: 400 };
      }
      const row = store.loadWithSecret(userId, providerId);
      const provider = await toProviderView(def, row);
      return { ok: true, value: { status: 'ok', provider } };
    },

    async deleteCredential(actor, providerIdRaw) {
      const userId = actorUserId(actor);
      if (!userId) return { ok: false, error: 'Nicht angemeldet.', status: 401 };
      const providerId = providerIdRaw.trim();
      const def = getProviderDefinition(providerId);
      if (!def) return { ok: false, error: 'Unbekannter Provider.', status: 400 };
      store.delete(userId, providerId);
      return { ok: true, value: { status: 'ok', providerId } };
    },

    async getOllamaSettings(actor) {
      const userId = actorUserId(actor);
      if (!userId) return { ok: false, error: 'Nicht angemeldet.', status: 401 };
      const settings = await ollamaView(userId);
      return { ok: true, value: { status: 'ok', settings } };
    },

    async upsertOllamaSettings(actor, input) {
      const userId = actorUserId(actor);
      if (!userId) return { ok: false, error: 'Nicht angemeldet.', status: 401 };
      if (!store.consumeRateLimit(userId, getRateLimit(env), RATE_WINDOW_SECONDS)) {
        return {
          ok: false,
          error: 'Zu viele Versuche. Bitte kurz warten.',
          status: 429,
          code: 'rate_limited',
        };
      }
      const safe = assertSafeOllamaBaseUrl(input.baseUrl);
      if (!safe.ok) return { ok: false, error: safe.message, status: 400 };
      const encRaw = encKey();
      if (!encRaw) {
        return {
          ok: false,
          error: 'Server-Verschlüsselung nicht konfiguriert (CREDENTIALS_ENCRYPTION_KEY).',
          status: 503,
          code: 'not-configured',
        };
      }
      const model = typeof input.model === 'string' ? input.model.trim() : '';
      if (!model || model.length > 128) {
        return { ok: false, error: 'Modell-ID fehlt oder ist zu lang.', status: 400 };
      }
      const existing = store.loadWithSecret(userId, OLLAMA_PROVIDER_ID);
      let ciphertext = existing?.secretCiphertext ?? OLLAMA_NONE_SECRET;
      let keyHint = existing?.keyHint ?? '••••none';
      let draftKey: string | null = null;
      if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
        draftKey = input.apiKey.trim().slice(0, 512);
        ciphertext = await encryptProviderSecret(draftKey, encRaw);
        keyHint = buildKeyHint(draftKey);
      } else if (ciphertext !== OLLAMA_NONE_SECRET) {
        try {
          draftKey = await decryptProviderSecret(ciphertext, encRaw);
        } catch {
          return { ok: false, error: 'Entschlüsselung fehlgeschlagen.', status: 500 };
        }
      }
      const probed = await fetchModels(safe.url, draftKey);
      if (!probed.ok) return { ok: false, error: probed.message, status: 400 };
      if (!probed.models.includes(model)) {
        return { ok: false, error: 'Modell ist auf dem Endpoint nicht verfügbar.', status: 400 };
      }
      const meta = {
        useCloud: input.useCloud === true,
        baseUrl: safe.url,
        model,
      };
      const saved = store.upsert({
        userId,
        providerId: OLLAMA_PROVIDER_ID,
        secretCiphertext: ciphertext,
        keyHint,
        status: 'active',
        meta,
      });
      if (!saved.ok) {
        return { ok: false, error: 'Einstellungen konnten nicht gespeichert werden.', status: 500 };
      }
      const settings = await ollamaView(userId);
      // Edge parity: upsert returns probed models so Organize UI can refresh the list.
      return { ok: true, value: { status: 'ok', settings, models: probed.models } };
    },

    async testOllamaSettings(actor, input) {
      const userId = actorUserId(actor);
      if (!userId) return { ok: false, error: 'Nicht angemeldet.', status: 401 };
      if (!store.consumeRateLimit(userId, getRateLimit(env), RATE_WINDOW_SECONDS)) {
        return {
          ok: false,
          error: 'Zu viele Versuche. Bitte kurz warten.',
          status: 429,
          code: 'rate_limited',
        };
      }
      const current = await ollamaView(userId);
      const baseUrl = input?.baseUrl?.trim() || current.baseUrl;
      const safe = assertSafeOllamaBaseUrl(baseUrl);
      if (!safe.ok) return { ok: false, error: safe.message, status: 400 };
      const encRaw = encKey();
      let apiKey: string | null = null;
      if (typeof input?.apiKey === 'string' && input.apiKey.trim()) {
        apiKey = input.apiKey.trim().slice(0, 512);
      } else {
        const row = store.loadWithSecret(userId, OLLAMA_PROVIDER_ID);
        if (row?.secretCiphertext && row.secretCiphertext !== OLLAMA_NONE_SECRET) {
          if (!encRaw) {
            return {
              ok: false,
              error: 'Server-Verschlüsselung nicht konfiguriert (CREDENTIALS_ENCRYPTION_KEY).',
              status: 503,
              code: 'not-configured',
            };
          }
          try {
            apiKey = await decryptProviderSecret(row.secretCiphertext, encRaw);
          } catch {
            return { ok: false, error: 'Entschlüsselung fehlgeschlagen.', status: 500 };
          }
        }
      }
      const models = await fetchModels(safe.url, apiKey);
      if (!models.ok) return { ok: false, error: models.message, status: 400 };
      return {
        ok: true,
        value: { status: 'ok', ok: true, message: 'Verbindung ok.', models: models.models },
      };
    },

    async listOllamaModels(actor, input) {
      const userId = actorUserId(actor);
      if (!userId) return { ok: false, error: 'Nicht angemeldet.', status: 401 };
      if (!store.consumeRateLimit(userId, getRateLimit(env), RATE_WINDOW_SECONDS)) {
        return {
          ok: false,
          error: 'Zu viele Versuche. Bitte kurz warten.',
          status: 429,
          code: 'rate_limited',
        };
      }
      const settings = await ollamaView(userId);
      const baseUrl = input?.baseUrl?.trim() || settings.baseUrl;
      const safe = assertSafeOllamaBaseUrl(baseUrl);
      if (!safe.ok) return { ok: false, error: safe.message, status: 400 };
      const encRaw = encKey();
      let apiKey: string | null = null;
      if (typeof input?.apiKey === 'string' && input.apiKey.trim()) {
        apiKey = input.apiKey.trim().slice(0, 512);
      } else {
        const row = store.loadWithSecret(userId, OLLAMA_PROVIDER_ID);
        if (row?.secretCiphertext && row.secretCiphertext !== OLLAMA_NONE_SECRET) {
          if (!encRaw) {
            return {
              ok: false,
              error: 'Server-Verschlüsselung nicht konfiguriert (CREDENTIALS_ENCRYPTION_KEY).',
              status: 503,
              code: 'not-configured',
            };
          }
          try {
            apiKey = await decryptProviderSecret(row.secretCiphertext, encRaw);
          } catch {
            return { ok: false, error: 'Entschlüsselung fehlgeschlagen.', status: 500 };
          }
        }
      }
      const models = await fetchModels(safe.url, apiKey);
      if (!models.ok) return { ok: false, error: models.message, status: 400 };
      return { ok: true, value: { status: 'ok', models: models.models } };
    },

    async clearOllamaSettings(actor) {
      const userId = actorUserId(actor);
      if (!userId) return { ok: false, error: 'Nicht angemeldet.', status: 401 };
      store.delete(userId, OLLAMA_PROVIDER_ID);
      const settings = await ollamaView(userId);
      return { ok: true, value: { status: 'ok', settings } };
    },
  };
}

export function createAiPortsStub(): AiPorts {
  const deny = async () => ({ ok: false as const, error: 'store-unavailable', status: 500 });
  return {
    moduleId: 'ai',
    store: null as unknown as CredentialStore,
    listCredentials: deny,
    upsertCredential: deny,
    refreshCredential: deny,
    deleteCredential: deny,
    getOllamaSettings: deny,
    upsertOllamaSettings: deny,
    testOllamaSettings: deny,
    listOllamaModels: deny,
    clearOllamaSettings: deny,
  };
}

export {
  AI_GM_ACTION_MAX_LENGTH,
  AI_GM_DEFAULT_RATE_LIMIT,
  AI_GM_NON_STREAM_CONTENT_TYPE,
  AI_GM_PUBLIC_ACTIVATION_AUTHORIZED,
  AI_GM_QUOTA_SWEEP_BATCH,
  AI_GM_RATE_LIMIT_WINDOW_SECONDS,
  AI_GM_STREAM_CONTENT_TYPE,
  aiGmAttemptDurableStateWrite,
  aiGmPipelineStageAfterMembership,
  consumeAiGmQuota,
  createAiGmQuotaBucket,
  formatAiGmNdjsonChunk,
  formatAiGmNdjsonStream,
  formatAiGmNonStreamResponse,
  parseAiGmNdjsonLineBuffer,
  validateAiGmRequest,
} from './internal/ai-gm-quarantine.ts';
export type {
  AiGmNonStreamResponse,
  AiGmQuotaBucket,
  AiGmQuotaEntry,
  AiGmRequestValidation,
  AiGmStateWriteResult,
  AiGmStreamChunk,
} from './internal/ai-gm-quarantine.ts';

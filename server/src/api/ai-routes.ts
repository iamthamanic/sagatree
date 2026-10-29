/**
 * Host HTTP adapters for infrastructure/ai (MIG-301 / #800).
 * Location: server/src/api/ai-routes.ts
 *
 * Action-shaped bodies match Edge `ai-provider-credentials` / `ollama-settings`.
 * No production cutover — Edge allowlist remains until an explicit cutover ticket.
 */
import type { Hono } from 'hono';
import type { Context } from 'hono';
import type { Actor } from '../modules/identity/index.ts';
import type { IdentityPorts } from '../modules/identity/index.ts';
import type { createAiProviderCredentialsUseCases } from '../application/ai-provider-credentials/index.ts';
import type { createOllamaSettingsUseCases } from '../application/ollama-settings/index.ts';
import { authDenyStatus } from './errors.ts';

export type AiHttpDeps = {
  readonly identity: IdentityPorts;
  readonly hostMode?: 'solo' | 'remote';
  readonly credentials: ReturnType<typeof createAiProviderCredentialsUseCases>;
  readonly ollama: ReturnType<typeof createOllamaSettingsUseCases>;
};

type JsonBody = Record<string, unknown>;

const CREDENTIAL_ACTIONS = new Set(['list', 'upsert', 'refresh', 'delete']);
const OLLAMA_ACTIONS = new Set(['get', 'upsert', 'test', 'listModels', 'clear']);
const CREDENTIAL_MODALITIES = new Set(['image', '3d', 'video', 'audio']);

function isRecord(value: unknown): value is JsonBody {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function contentTypeIsJson(c: Context): boolean {
  const raw = c.req.header('content-type') ?? '';
  return raw.toLowerCase().includes('application/json');
}

async function readJsonBody(c: Context): Promise<
  { ok: true; body: JsonBody } | { ok: false; status: number; message: string }
> {
  // Reject non-JSON Content-Type so cross-origin "simple" text/plain POSTs cannot mutate.
  if (!contentTypeIsJson(c)) {
    return { ok: false, status: 415, message: 'Content-Type application/json erforderlich.' };
  }
  try {
    const text = await c.req.text();
    if (!text || text.trim().length === 0) return { ok: true, body: {} };
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) {
      return { ok: false, status: 400, message: 'Ungültiger Request-Body.' };
    }
    return { ok: true, body: parsed };
  } catch {
    return { ok: false, status: 400, message: 'Ungültiger Request-Body.' };
  }
}

/**
 * Solo fallback is only for local hosts without a cookie profile mounted.
 * ORIGIN_DENIED / HOST_DENIED / forged identity claims stay fail-closed (CSRF).
 */
async function resolveActor(
  deps: AiHttpDeps,
  headers: Headers,
  body: unknown,
): Promise<{ ok: true; actor: Actor } | { ok: false; status: number; error: string }> {
  const remote = await deps.identity.resolveRemoteSession(headers, {
    allowSameOriginRead: false,
    body,
  });
  if (remote.ok) return { ok: true, actor: remote.actor };
  if (deps.hostMode === 'solo' && remote.code === 'AUTH_NOT_CONFIGURED') {
    return { ok: true, actor: deps.identity.resolveSoloActor() };
  }
  return { ok: false, status: authDenyStatus(remote.code), error: remote.code };
}

function aiFailBody(error: string, status: number, code?: string) {
  if (status === 503 || code === 'not-configured') {
    return { status: 'not-configured' as const, message: error, ...(code ? { code } : {}) };
  }
  return { status: 'error' as const, message: error, ...(code ? { code } : {}) };
}

function parseCredentialAction(body: JsonBody): string | null {
  return typeof body.action === 'string' && CREDENTIAL_ACTIONS.has(body.action)
    ? body.action
    : null;
}

function parseOllamaAction(body: JsonBody): string | null {
  return typeof body.action === 'string' && OLLAMA_ACTIONS.has(body.action) ? body.action : null;
}

function parseProviderId(body: JsonBody): string {
  return typeof body.providerId === 'string' ? body.providerId.trim() : '';
}

function parseApiKey(body: JsonBody): string {
  return typeof body.apiKey === 'string' ? body.apiKey : '';
}

function parseModality(body: JsonBody): string | null {
  return typeof body.modality === 'string' && CREDENTIAL_MODALITIES.has(body.modality)
    ? body.modality
    : null;
}

/**
 * Mount MIG-301 AI credential + Ollama settings HTTP adapters on a Hono app.
 */
export function mountAiHttpRoutes(app: Hono, deps: AiHttpDeps): void {
  app.post('/api/v1/ai/provider-credentials', async (c) => {
    const parsed = await readJsonBody(c);
    if (!parsed.ok) {
      return c.json({ status: 'error', message: parsed.message }, parsed.status);
    }
    const body = parsed.body;
    const actorResult = await resolveActor(deps, c.req.raw.headers, body);
    if (!actorResult.ok) {
      return c.json(
        { status: 'error', message: 'Nicht angemeldet.', code: actorResult.error },
        actorResult.status,
      );
    }
    const action = parseCredentialAction(body);
    if (!action) {
      return c.json({ status: 'error', message: 'Unbekannte Aktion.' }, 400);
    }
    const actor = actorResult.actor;

    if (action === 'list') {
      const modality = parseModality(body);
      const result = await deps.credentials.list(actor, modality);
      if (!result.ok) {
        return c.json(aiFailBody(result.error, result.status, result.code), result.status);
      }
      return c.json(result.value, 200);
    }
    if (action === 'upsert') {
      const providerId = parseProviderId(body);
      const apiKey = parseApiKey(body);
      if (!providerId || !apiKey.trim()) {
        return c.json({ status: 'error', message: 'providerId und apiKey sind erforderlich.' }, 400);
      }
      const result = await deps.credentials.upsert(actor, providerId, apiKey);
      if (!result.ok) {
        return c.json(aiFailBody(result.error, result.status, result.code), result.status);
      }
      return c.json(result.value, 200);
    }
    if (action === 'refresh') {
      const providerId = parseProviderId(body);
      if (!providerId) {
        return c.json({ status: 'error', message: 'providerId ist erforderlich.' }, 400);
      }
      const result = await deps.credentials.refresh(actor, providerId);
      if (!result.ok) {
        return c.json(aiFailBody(result.error, result.status, result.code), result.status);
      }
      return c.json(result.value, 200);
    }
    // action === 'delete'
    const providerId = parseProviderId(body);
    if (!providerId) {
      return c.json({ status: 'error', message: 'providerId ist erforderlich.' }, 400);
    }
    const result = await deps.credentials.delete(actor, providerId);
    if (!result.ok) {
      return c.json(aiFailBody(result.error, result.status, result.code), result.status);
    }
    return c.json(result.value, 200);
  });

  app.post('/api/v1/ai/ollama-settings', async (c) => {
    const parsed = await readJsonBody(c);
    if (!parsed.ok) {
      return c.json({ status: 'error', message: parsed.message }, parsed.status);
    }
    const body = parsed.body;
    const actorResult = await resolveActor(deps, c.req.raw.headers, body);
    if (!actorResult.ok) {
      return c.json(
        { status: 'error', message: 'Nicht angemeldet.', code: actorResult.error },
        actorResult.status,
      );
    }
    const action = parseOllamaAction(body);
    if (!action) {
      return c.json({ status: 'error', message: 'Unbekannte Aktion.' }, 400);
    }
    const actor = actorResult.actor;

    if (action === 'get') {
      const result = await deps.ollama.get(actor);
      if (!result.ok) {
        return c.json(aiFailBody(result.error, result.status, result.code), result.status);
      }
      return c.json(result.value, 200);
    }
    if (action === 'upsert') {
      const result = await deps.ollama.upsert(actor, {
        useCloud: body.useCloud === true,
        baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : '',
        model: typeof body.model === 'string' ? body.model : '',
        ...(typeof body.apiKey === 'string' && body.apiKey.trim()
          ? { apiKey: body.apiKey.trim() }
          : {}),
      });
      if (!result.ok) {
        return c.json(aiFailBody(result.error, result.status, result.code), result.status);
      }
      return c.json(result.value, 200);
    }
    if (action === 'test') {
      const result = await deps.ollama.test(actor, {
        useCloud: body.useCloud === true,
        baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
        model: typeof body.model === 'string' ? body.model : undefined,
        ...(typeof body.apiKey === 'string' && body.apiKey.trim()
          ? { apiKey: body.apiKey.trim() }
          : {}),
      });
      if (!result.ok) {
        return c.json(aiFailBody(result.error, result.status, result.code), result.status);
      }
      return c.json(result.value, 200);
    }
    if (action === 'listModels') {
      const result = await deps.ollama.listModels(actor, {
        useCloud: body.useCloud === true,
        baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
        ...(typeof body.apiKey === 'string' && body.apiKey.trim()
          ? { apiKey: body.apiKey.trim() }
          : {}),
      });
      if (!result.ok) {
        return c.json(aiFailBody(result.error, result.status, result.code), result.status);
      }
      return c.json(result.value, 200);
    }
    // action === 'clear'
    const result = await deps.ollama.clear(actor);
    if (!result.ok) {
      return c.json(aiFailBody(result.error, result.status, result.code), result.status);
    }
    return c.json(result.value, 200);
  });
}

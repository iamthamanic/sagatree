/**
 * Host HTTP adapters for infrastructure/ai (MIG-301 / #800).
 * Location: server/src/api/ai-routes.ts
 *
 * Action-shaped bodies match Edge `ai-provider-credentials` / `ollama-settings`.
 * No production cutover — Edge allowlist remains until an explicit cutover ticket.
 */
import type { Hono } from 'hono';
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

function isRecord(value: unknown): value is JsonBody {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonSafe(c: {
  req: { text: () => Promise<string> };
}): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    const text = await c.req.text();
    if (!text || text.trim().length === 0) return { ok: true, body: {} };
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

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
  if (deps.hostMode === 'solo') {
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

/**
 * Mount MIG-301 AI credential + Ollama settings HTTP adapters on a Hono app.
 */
export function mountAiHttpRoutes(app: Hono, deps: AiHttpDeps): void {
  app.post('/api/v1/ai/provider-credentials', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) {
      return c.json({ status: 'error', message: 'Ungültige Serverantwort.' }, 400);
    }
    const body = isRecord(parsed.body) ? parsed.body : {};
    const actorResult = await resolveActor(deps, c.req.raw.headers, body);
    if (!actorResult.ok) {
      return c.json(
        { status: 'error', message: 'Nicht angemeldet.', code: actorResult.error },
        actorResult.status,
      );
    }
    const action = typeof body.action === 'string' ? body.action : '';
    const actor = actorResult.actor;

    if (action === 'list') {
      const modality = typeof body.modality === 'string' ? body.modality : null;
      const result = await deps.credentials.list(actor, modality);
      if (!result.ok) {
        return c.json(aiFailBody(result.error, result.status, result.code), result.status);
      }
      return c.json(result.value, 200);
    }
    if (action === 'upsert') {
      const providerId = typeof body.providerId === 'string' ? body.providerId : '';
      const apiKey = typeof body.apiKey === 'string' ? body.apiKey : '';
      const result = await deps.credentials.upsert(actor, providerId, apiKey);
      if (!result.ok) {
        return c.json(aiFailBody(result.error, result.status, result.code), result.status);
      }
      return c.json(result.value, 200);
    }
    if (action === 'refresh') {
      const providerId = typeof body.providerId === 'string' ? body.providerId : '';
      const result = await deps.credentials.refresh(actor, providerId);
      if (!result.ok) {
        return c.json(aiFailBody(result.error, result.status, result.code), result.status);
      }
      return c.json(result.value, 200);
    }
    if (action === 'delete') {
      const providerId = typeof body.providerId === 'string' ? body.providerId : '';
      const result = await deps.credentials.delete(actor, providerId);
      if (!result.ok) {
        return c.json(aiFailBody(result.error, result.status, result.code), result.status);
      }
      return c.json(result.value, 200);
    }
    return c.json({ status: 'error', message: 'Unbekannte Aktion.' }, 400);
  });

  app.post('/api/v1/ai/ollama-settings', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) {
      return c.json({ status: 'error', message: 'Ungültige Serverantwort.' }, 400);
    }
    const body = isRecord(parsed.body) ? parsed.body : {};
    const actorResult = await resolveActor(deps, c.req.raw.headers, body);
    if (!actorResult.ok) {
      return c.json(
        { status: 'error', message: 'Nicht angemeldet.', code: actorResult.error },
        actorResult.status,
      );
    }
    const action = typeof body.action === 'string' ? body.action : '';
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
    if (action === 'clear') {
      const result = await deps.ollama.clear(actor);
      if (!result.ok) {
        return c.json(aiFailBody(result.error, result.status, result.code), result.status);
      }
      return c.json(result.value, 200);
    }
    return c.json({ status: 'error', message: 'Unbekannte Aktion.' }, 400);
  });
}

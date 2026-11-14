/**
 * Host HTTP adapters for infrastructure/ai (MIG-301 / #800 + CUT-13 / #1148 + CUT-15 / #1150 + CUT-18 / #1153 + AIB-04 / #1127).
 * Location: server/src/api/ai-routes.ts
 *
 * Action-shaped bodies match Edge `ai-provider-credentials` / `ollama-settings`.
 * Character lore generate-background mounts at POST `/api/v1/ai/character-lore`.
 * Look reference analysis mounts at POST `/api/v1/ai/look-reference-analysis`.
 * Character avatar Meshy mounts at POST `/api/v1/ai/character-avatar-meshy`.
 * Aiberto ask mounts at POST `/api/v1/ai/aiberto-ask` (+ `/stream` SSE).
 */
import type { Hono } from 'hono';
import type { Context } from 'hono';
import type { Actor } from '../modules/identity/index.ts';
import type { IdentityPorts } from '../modules/identity/index.ts';
import type { createAiProviderCredentialsUseCases } from '../application/ai-provider-credentials/index.ts';
import type { createOllamaSettingsUseCases } from '../application/ollama-settings/index.ts';
import type { CharacterLoreUseCases } from '../application/character-lore/index.ts';
import type { LookReferenceAnalysisUseCases } from '../application/look-reference-analysis/index.ts';
import type { CharacterAvatarMeshyUseCases } from '../application/character-avatar-meshy/index.ts';
import type { AibertoAskUseCases } from '../application/aiberto-ask/index.ts';
import {
  AIBERTO_ASK_MAX_REQUEST_BYTES,
  checkAibertoAskBodySize,
} from '../application/aiberto-ask/index.ts';
import {
  LOOK_REF_MAX_REQUEST_BYTES,
  checkContentLengthEnvelope,
} from '../application/look-reference-analysis/index.ts';
import {
  CHARACTER_LORE_MAX_REQUEST_BYTES,
  checkCharacterLoreBodySize,
} from '../modules/character/character-lore.ts';
import { MESHY_AVATAR_IMAGE_MAX_BYTES } from '../modules/character/character-avatar-meshy.ts';
import { isLoopbackHost } from '../auth/solo/bind-guard.ts';
import { authDenyStatus } from './errors.ts';

/** Base64 image data-URI expands ~4/3; allow envelope headroom over decoded max. */
const AVATAR_MESHY_MAX_REQUEST_BYTES = Math.ceil(MESHY_AVATAR_IMAGE_MAX_BYTES * 1.4) + 64 * 1024;

export type AiHttpDeps = {
  readonly identity: IdentityPorts;
  readonly hostMode?: 'solo' | 'remote';
  readonly credentials: ReturnType<typeof createAiProviderCredentialsUseCases>;
  readonly ollama: ReturnType<typeof createOllamaSettingsUseCases>;
  /** CUT-13 — optional until composition root wires character-lore use-cases. */
  readonly characterLore?: CharacterLoreUseCases;
  /** CUT-15 — look reference vision analysis. */
  readonly lookReferenceAnalysis?: LookReferenceAnalysisUseCases;
  /** CUT-18 — character avatar Meshy generation. */
  readonly characterAvatarMeshy?: CharacterAvatarMeshyUseCases;
  /** AIB-04 — evidence-gated Core rulebook ask (SSE + JSON). */
  readonly aibertoAsk?: AibertoAskUseCases;
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

function requestHostName(headers: Headers): string {
  const raw = (headers.get('host') ?? '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']');
    return end >= 0 ? raw.slice(1, end) : raw;
  }
  return raw.split(':')[0] ?? '';
}

/**
 * Solo fallback is only for loopback hosts without a cookie profile mounted.
 * AUTH_NOT_CONFIGURED alone is insufficient — require loopback Host (+ Origin)
 * so DNS-rebinding attackers cannot inherit the solo owner actor.
 */
function normalizeHostname(hostname: string): string {
  const raw = hostname.trim().toLowerCase();
  // URL.hostname keeps IPv6 brackets (`[::1]`); strip for loopback allowlist match.
  if (raw.startsWith('[') && raw.endsWith(']')) return raw.slice(1, -1);
  return raw;
}

function soloAuthNotConfiguredAllowed(headers: Headers): boolean {
  if (!isLoopbackHost(requestHostName(headers))) return false;
  const origin = headers.get('origin');
  if (!origin) return true;
  try {
    return isLoopbackHost(normalizeHostname(new URL(origin).hostname));
  } catch {
    return false;
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
    if (!soloAuthNotConfiguredAllowed(headers)) {
      return { ok: false, status: 403, error: 'HOST_DENIED' };
    }
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

  // CUT-13: character lore generate-background (Edge `character-lore` parity).
  if (deps.characterLore?.publicActivationAuthorized) {
    app.post('/api/v1/ai/character-lore', async (c) => {
      const lore = deps.characterLore;
      if (!lore) {
        return c.json(
          {
            status: 'error',
            message:
              'Character-Lore ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.',
          },
          503,
        );
      }
      if (!contentTypeIsJson(c)) {
        return c.json(
          { status: 'error', message: 'Content-Type application/json erforderlich.' },
          415,
        );
      }
      // Reject oversized declared Content-Length before buffering (Codex P1).
      const contentLengthHeader = c.req.header('content-length') ?? null;
      const headerSize = checkCharacterLoreBodySize(contentLengthHeader);
      if (!headerSize.ok) {
        return c.json(
          { status: 'error', message: headerSize.message },
          headerSize.status,
        );
      }

      let rawText = '';
      try {
        const stream = c.req.raw.body;
        if (!stream) {
          rawText = '';
        } else {
          const reader = stream.getReader();
          const chunks: Uint8Array[] = [];
          let total = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              total += value.byteLength;
              if (total > CHARACTER_LORE_MAX_REQUEST_BYTES) {
                await reader.cancel().catch(() => undefined);
                return c.json(
                  {
                    status: 'error',
                    message:
                      'Request-Body ist zu groß. Bitte kürze Charakterdaten und versuche es erneut.',
                  },
                  413,
                );
              }
              chunks.push(value);
            }
          }
          rawText = Buffer.concat(chunks.map((u) => Buffer.from(u))).toString('utf8');
        }
      } catch {
        return c.json({ status: 'error', message: 'Ungültiger Request-Body.' }, 400);
      }
      const rawBodyUtf8Bytes = Buffer.byteLength(rawText, 'utf8');
      const decodedSize = checkCharacterLoreBodySize(null, rawBodyUtf8Bytes);
      if (!decodedSize.ok) {
        return c.json(
          { status: 'error', message: decodedSize.message },
          decodedSize.status,
        );
      }
      let body: unknown = {};
      if (rawText.trim().length > 0) {
        try {
          body = JSON.parse(rawText) as unknown;
        } catch {
          return c.json({ status: 'error', message: 'Ungültiger Request-Body.' }, 400);
        }
      }
      const actorResult = await resolveActor(deps, c.req.raw.headers, body);
      if (!actorResult.ok) {
        return c.json(
          { status: 'error', message: 'Nicht angemeldet.', code: actorResult.error },
          actorResult.status,
        );
      }
      const result = await lore.generate(actorResult.actor, {
        contentLengthHeader,
        rawBodyUtf8Bytes,
        body,
      });
      if (result.status === 'ok') {
        return c.json(
          {
            status: 'ok' as const,
            story: result.story,
            provider: result.provider,
            model: result.model,
          },
          200,
        );
      }
      if (result.status === 'not-configured') {
        return c.json(
          { status: 'not-configured' as const, message: result.message },
          result.httpStatus,
        );
      }
      return c.json(
        { status: 'error' as const, message: result.message },
        result.httpStatus,
      );
    });
  }

  // CUT-15: look reference analysis (Edge `look-reference-analysis` parity).
  if (deps.lookReferenceAnalysis?.publicActivationAuthorized) {
    app.post('/api/v1/ai/look-reference-analysis', async (c) => {
      const lookUc = deps.lookReferenceAnalysis;
      if (!lookUc) {
        return c.json(
          {
            status: 'error',
            message:
              'Look-Referenzanalyse ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.',
          },
          503,
        );
      }
      if (!contentTypeIsJson(c)) {
        return c.json(
          { status: 'error', message: 'Content-Type application/json erforderlich.' },
          415,
        );
      }
      const contentLengthHeader = c.req.header('content-length') ?? null;
      const headerSize = checkContentLengthEnvelope(contentLengthHeader);
      if (!headerSize.ok) {
        return c.json(
          { status: 'error', message: headerSize.message },
          headerSize.status,
        );
      }

      let rawText = '';
      try {
        const stream = c.req.raw.body;
        if (!stream) {
          rawText = '';
        } else {
          const reader = stream.getReader();
          const chunks: Uint8Array[] = [];
          let total = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              total += value.byteLength;
              if (total > LOOK_REF_MAX_REQUEST_BYTES) {
                await reader.cancel().catch(() => undefined);
                return c.json(
                  { status: 'error', message: 'Request too large' },
                  413,
                );
              }
              chunks.push(value);
            }
          }
          rawText = Buffer.concat(chunks.map((u) => Buffer.from(u))).toString('utf8');
        }
      } catch {
        return c.json({ status: 'error', message: 'Ungültiger Request-Body.' }, 400);
      }

      let body: unknown = {};
      if (rawText.trim().length > 0) {
        try {
          body = JSON.parse(rawText) as unknown;
        } catch {
          return c.json({ status: 'error', message: 'Ungültiger Request-Body.' }, 400);
        }
      }

      const actorResult = await resolveActor(deps, c.req.raw.headers, body);
      if (!actorResult.ok) {
        return c.json(
          { status: 'error', message: 'Nicht angemeldet.', code: actorResult.error },
          actorResult.status,
        );
      }

      const result = await lookUc.analyzeForActor(actorResult.actor, {
        contentLengthHeader,
        body,
      });
      if (result.status === 'ok') {
        return c.json(
          {
            status: 'ok' as const,
            payload: result.payload,
            analyzedAtIso: result.analyzedAtIso,
          },
          200,
        );
      }
      if (result.status === 'not-configured') {
        return c.json(
          { status: 'not-configured' as const, message: result.message },
          200,
        );
      }
      return c.json(
        { status: 'error' as const, message: result.message },
        result.httpStatus,
      );
    });
  }

  // CUT-18: character-avatar-meshy (Edge `character-avatar-meshy` parity).
  if (deps.characterAvatarMeshy?.publicActivationAuthorized) {
    app.post('/api/v1/ai/character-avatar-meshy', async (c) => {
      const uc = deps.characterAvatarMeshy;
      if (!uc) {
        return c.json(
          {
            status: 'error',
            message:
              'Avatar-3D-Generierung ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.',
          },
          503,
        );
      }
      if (!contentTypeIsJson(c)) {
        return c.json(
          { status: 'error', message: 'Content-Type application/json erforderlich.' },
          415,
        );
      }
      const contentLengthHeader = c.req.header('content-length');
      if (contentLengthHeader) {
        const declared = Number(contentLengthHeader);
        if (Number.isFinite(declared) && declared > AVATAR_MESHY_MAX_REQUEST_BYTES) {
          return c.json(
            { status: 'error', message: 'Request-Body ist zu groß.' },
            413,
          );
        }
      }
      let rawText = '';
      try {
        rawText = await c.req.text();
      } catch {
        return c.json({ status: 'error', message: 'Ungültiger Request-Body.' }, 400);
      }
      if (Buffer.byteLength(rawText, 'utf8') > AVATAR_MESHY_MAX_REQUEST_BYTES) {
        return c.json({ status: 'error', message: 'Request-Body ist zu groß.' }, 413);
      }
      let body: JsonBody = {};
      if (rawText.trim().length > 0) {
        try {
          const parsed: unknown = JSON.parse(rawText);
          if (!isRecord(parsed)) {
            return c.json({ status: 'error', message: 'Ungültiger Request-Body.' }, 400);
          }
          body = parsed;
        } catch {
          return c.json({ status: 'error', message: 'Ungültiger Request-Body.' }, 400);
        }
      }
      const actorResult = await resolveActor(deps, c.req.raw.headers, body);
      if (!actorResult.ok) {
        return c.json(
          { status: 'error', message: 'Nicht angemeldet.', code: actorResult.error },
          actorResult.status,
        );
      }
      const action = typeof body.action === 'string' ? body.action.trim() : '';
      let result;
      switch (action) {
        case 'config':
          result = await uc.httpConfig(actorResult.actor);
          break;
        case 'start':
          result = await uc.httpStart(actorResult.actor, {
            clientNonce: body.clientNonce,
            generationMode: body.generationMode,
            prompt: body.prompt,
            imageDataUri: body.imageDataUri,
            texturePrompt: body.texturePrompt,
            providerId: body.providerId,
            settings: body.settings,
          });
          break;
        case 'poll':
          result = await uc.httpPoll(
            actorResult.actor,
            typeof body.jobId === 'string' ? body.jobId : '',
          );
          break;
        case 'get':
          result = await uc.httpGet(
            actorResult.actor,
            typeof body.jobId === 'string' ? body.jobId : '',
          );
          break;
        case 'retry':
          result = await uc.httpRetry(
            actorResult.actor,
            typeof body.jobId === 'string' ? body.jobId : '',
          );
          break;
        case 'signStoragePath':
          result = uc.httpSignStoragePath(
            actorResult.actor,
            typeof body.storagePath === 'string' ? body.storagePath : '',
          );
          break;
        default:
          result = {
            status: 'error' as const,
            message: 'Ungültige Aktion.',
            httpStatus: 400,
          };
      }
      if (result.status === 'ok') {
        const { httpStatus: _h, ...rest } = result;
        return c.json(rest, 200);
      }
      if (result.status === 'not-configured') {
        return c.json(
          { status: 'not-configured' as const, message: result.message },
          typeof result.httpStatus === 'number' ? result.httpStatus : 503,
        );
      }
      return c.json(
        {
          status: 'error' as const,
          message: result.message,
          ...(typeof result.code === 'string' ? { code: result.code } : {}),
        },
        typeof result.httpStatus === 'number' ? result.httpStatus : 500,
      );
    });
  }

  // AIB-04: aiberto-ask (JSON + SSE). Flag/default-off handled inside use-case.
  if (deps.aibertoAsk) {
    const readAibertoBody = async (
      c: Context,
    ): Promise<
      | {
          ok: true;
          body: unknown;
          rawBodyUtf8Bytes: number;
          contentLengthHeader: string | null;
        }
      | { ok: false; status: number; message: string }
    > => {
      if (!contentTypeIsJson(c)) {
        return { ok: false, status: 415, message: 'Content-Type application/json erforderlich.' };
      }
      const contentLengthHeader = c.req.header('content-length') ?? null;
      const headerSize = checkAibertoAskBodySize(contentLengthHeader);
      if (!headerSize.ok) {
        return { ok: false, status: headerSize.status, message: headerSize.message };
      }
      let rawText = '';
      try {
        const stream = c.req.raw.body;
        if (stream) {
          const reader = stream.getReader();
          const chunks: Uint8Array[] = [];
          let total = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              total += value.byteLength;
              if (total > AIBERTO_ASK_MAX_REQUEST_BYTES) {
                await reader.cancel().catch(() => undefined);
                return {
                  ok: false,
                  status: 413,
                  message:
                    'Request-Body ist zu groß. Bitte kürze die Frage und versuche es erneut.',
                };
              }
              chunks.push(value);
            }
          }
          rawText = Buffer.concat(chunks.map((u) => Buffer.from(u))).toString('utf8');
        }
      } catch {
        return { ok: false, status: 400, message: 'Ungültiger Request-Body.' };
      }
      const rawBodyUtf8Bytes = Buffer.byteLength(rawText, 'utf8');
      const decodedSize = checkAibertoAskBodySize(null, rawBodyUtf8Bytes);
      if (!decodedSize.ok) {
        return { ok: false, status: decodedSize.status, message: decodedSize.message };
      }
      let body: unknown = {};
      if (rawText.trim().length > 0) {
        try {
          body = JSON.parse(rawText) as unknown;
        } catch {
          return { ok: false, status: 400, message: 'Ungültiger Request-Body.' };
        }
      }
      return { ok: true, body, rawBodyUtf8Bytes, contentLengthHeader };
    };

    app.post('/api/v1/ai/aiberto-ask', async (c) => {
      const ask = deps.aibertoAsk;
      if (!ask) {
        return c.json(
          { status: 'error', message: 'Aiberto-Ask ist vorübergehend nicht verfügbar.' },
          503,
        );
      }
      const parsed = await readAibertoBody(c);
      if (!parsed.ok) {
        return c.json({ status: 'error', message: parsed.message }, parsed.status);
      }
      const actorResult = await resolveActor(deps, c.req.raw.headers, parsed.body);
      if (!actorResult.ok) {
        return c.json(
          { status: 'error', message: 'Nicht angemeldet.', code: actorResult.error },
          actorResult.status,
        );
      }
      const result = await ask.ask(actorResult.actor, {
        body: parsed.body,
        contentLengthHeader: parsed.contentLengthHeader,
        rawBodyUtf8Bytes: parsed.rawBodyUtf8Bytes,
      });
      if (result.status === 'ok' || result.status === 'unanswered') {
        return c.json(result, 200);
      }
      if (result.status === 'not-configured') {
        return c.json(result, 200);
      }
      if (result.status === 'disabled') {
        return c.json(result, 503);
      }
      return c.json(
        {
          status: 'error' as const,
          code: result.code,
          message: result.message,
        },
        result.httpStatus,
      );
    });

    app.post('/api/v1/ai/aiberto-ask/stream', async (c) => {
      const ask = deps.aibertoAsk;
      if (!ask) {
        return c.json(
          { status: 'error', message: 'Aiberto-Ask ist vorübergehend nicht verfügbar.' },
          503,
        );
      }
      const parsed = await readAibertoBody(c);
      if (!parsed.ok) {
        return c.json({ status: 'error', message: parsed.message }, parsed.status);
      }
      const actorResult = await resolveActor(deps, c.req.raw.headers, parsed.body);
      if (!actorResult.ok) {
        return c.json(
          { status: 'error', message: 'Nicht angemeldet.', code: actorResult.error },
          actorResult.status,
        );
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const write = (event: string, data: unknown) => {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
            );
          };
          try {
            for await (const evt of ask.askStream(actorResult.actor, {
              body: parsed.body,
              contentLengthHeader: parsed.contentLengthHeader,
              rawBodyUtf8Bytes: parsed.rawBodyUtf8Bytes,
            })) {
              write(evt.event, evt.data);
            }
          } catch {
            write('error', {
              status: 'error',
              code: 'INTERNAL',
              message: 'Aiberto-Ask Stream fehlgeschlagen.',
              httpStatus: 500,
            });
          } finally {
            try {
              controller.close();
            } catch {
              /* already closed */
            }
          }
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    });
  }
}

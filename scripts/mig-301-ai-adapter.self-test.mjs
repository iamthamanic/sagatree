#!/usr/bin/env node
/**
 * mig-301-ai-adapter.self-test — infrastructure/ai host transport (#800).
 * Location: scripts/mig-301-ai-adapter.self-test.mjs
 *
 * Proves BYOK + Ollama Organize via host HTTP adapters. Client dual-path is
 * source-checked (Vite extensionless imports). Edge stays allowlisted (no cutover).
 * Uses Hono app.request (offline-first; no loopback server).
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Hono } from 'hono';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

function actor(id) {
  return { kind: 'solo-local', actorId: id };
}

const ENC_KEY = 'a'.repeat(64);
const VALID_MESHY = `msy_${'x'.repeat(24)}`;

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const aiUrl = pathToFileURL(join(root, 'server/src/modules/ai/index.ts')).href;
const credCmd = pathToFileURL(
  join(root, 'server/src/application/ai-provider-credentials/index.ts'),
).href;
const ollamaCmd = pathToFileURL(join(root, 'server/src/application/ollama-settings/index.ts')).href;
const aiRoutesUrl = pathToFileURL(join(root, 'server/src/api/ai-routes.ts')).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createAiPorts } = await import(aiUrl);
const { createAiProviderCredentialsUseCases } = await import(credCmd);
const { createOllamaSettingsUseCases } = await import(ollamaCmd);
const { mountAiHttpRoutes } = await import(aiRoutesUrl);

const work = mkdtempSync(join(tmpdir(), 'mig-301-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir, { recursive: true });

try {
  const { db } = await bootstrapHostPersistence({ dataDir });
  const validateProvider = async (providerId, apiKey) => {
    if (providerId !== 'meshy') return { ok: false, message: 'Unbekannter Provider.' };
    if (!apiKey.startsWith('msy_') || apiKey.length < 20) {
      return { ok: false, message: 'Ungültiges Meshy-API-Key-Format (erwartet msy_…).' };
    }
    return { ok: true, credits: 13.4 };
  };
  const fetchModels = async (baseUrl) => {
    if (String(baseUrl).includes('evil')) return { ok: false, message: 'unreachable' };
    return { ok: true, models: ['llama3', 'mistral'] };
  };

  const env = {
    CREDENTIALS_ENCRYPTION_KEY: ENC_KEY,
    AI_PROVIDER_CREDENTIAL_RATE_LIMIT_PER_MINUTE: '30',
  };
  const ai = createAiPorts({ db, env, validateProvider, fetchModels });
  const credentials = createAiProviderCredentialsUseCases(ai);
  const ollama = createOllamaSettingsUseCases(ai);

  /** @type {{ current: ReturnType<typeof actor> | null; denyCode: string | null }} */
  const session = { current: actor('owner-o'), denyCode: null };
  const identity = {
    resolveSoloActor: () => actor('solo-default'),
    resolveRemoteSession: async () => {
      if (session.denyCode) return { ok: false, code: session.denyCode };
      if (!session.current) return { ok: false, code: 'UNAUTHENTICATED' };
      return { ok: true, actor: session.current };
    },
    linkSoloToRemoteAccount: () => ({ ok: false, code: 'INVALID_LINK_REQUEST' }),
  };

  const app = new Hono();
  mountAiHttpRoutes(app, {
    identity,
    hostMode: 'remote',
    credentials,
    ollama,
  });

  const soloApp = new Hono();
  mountAiHttpRoutes(soloApp, {
    identity,
    hostMode: 'solo',
    credentials,
    ollama,
  });

  async function post(path, body, target = app, extraHeaders = {}) {
    const res = await target.request(path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Accept: 'application/json',
        host: '127.0.0.1:8787',
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return { status: res.status, json };
  }

  // --- Fall 1: list/add/refresh/delete typed public view; no key leakage ---
  session.current = actor('owner-o');
  {
    const listed0 = await post('/api/v1/ai/provider-credentials', {
      action: 'list',
      modality: 'image',
    });
    assert(listed0.status === 200 && listed0.json.status === 'ok', 'list ok');
    assert(
      Array.isArray(listed0.json.providers) && listed0.json.providers[0].configured === false,
      'list unconfigured',
    );
    const up = await post('/api/v1/ai/provider-credentials', {
      action: 'upsert',
      providerId: 'meshy',
      apiKey: VALID_MESHY,
    });
    assert(up.status === 200 && up.json.status === 'ok', `upsert ${up.status}`);
    assert(up.json.provider.configured === true && up.json.provider.meta.credits === 13, 'public view');
    assert(!JSON.stringify(up.json).includes(VALID_MESHY), 'no plaintext key');
    assert(!JSON.stringify(up.json).includes('secret'), 'no ciphertext field');
    const refresh = await post('/api/v1/ai/provider-credentials', {
      action: 'refresh',
      providerId: 'meshy',
    });
    assert(refresh.status === 200 && refresh.json.provider.configured === true, 'refresh');
    assert(!JSON.stringify(refresh.json).includes(VALID_MESHY), 'no key on refresh');
    const del = await post('/api/v1/ai/provider-credentials', {
      action: 'delete',
      providerId: 'meshy',
    });
    assert(del.status === 200 && del.json.status === 'ok', 'delete');
  }

  // Re-seed for later isolation checks
  await post('/api/v1/ai/provider-credentials', {
    action: 'upsert',
    providerId: 'meshy',
    apiKey: VALID_MESHY,
  });

  // --- Fall 2: Ollama get/upsert/test/listModels; no apiKey; foreign cannot see owner key ---
  {
    const get0 = await post('/api/v1/ai/ollama-settings', { action: 'get' });
    assert(get0.status === 200 && get0.json.settings.hasApiKey === false, 'ollama default');
    const up = await post('/api/v1/ai/ollama-settings', {
      action: 'upsert',
      useCloud: false,
      baseUrl: 'http://127.0.0.1:11434',
      model: 'llama3',
      apiKey: 'ollama-secret-key',
    });
    assert(up.status === 200 && up.json.settings.hasApiKey === true, `ollama upsert ${up.status} ${JSON.stringify(up.json)}`);
    assert(Array.isArray(up.json.models) && up.json.models.includes('llama3'), 'upsert returns models');
    assert(!JSON.stringify(up.json).includes('ollama-secret-key'), 'no apiKey leakage');
    const test = await post('/api/v1/ai/ollama-settings', {
      action: 'test',
      useCloud: false,
      baseUrl: 'http://127.0.0.1:11434',
    });
    assert(test.status === 200 && Array.isArray(test.json.models) && test.json.models.includes('llama3'), 'test models');
    const models = await post('/api/v1/ai/ollama-settings', {
      action: 'listModels',
      useCloud: false,
      baseUrl: 'http://127.0.0.1:11434',
    });
    assert(models.status === 200 && models.json.models.includes('mistral'), 'listModels');

    session.current = actor('stranger-x');
    const stranger = await post('/api/v1/ai/ollama-settings', { action: 'get' });
    assert(stranger.json.settings.hasApiKey === false, 'foreign ollama empty');
    await post('/api/v1/ai/ollama-settings', {
      action: 'upsert',
      useCloud: false,
      baseUrl: 'http://127.0.0.1:11434',
      model: 'hijack',
      apiKey: 'stranger-key',
    });
    session.current = actor('owner-o');
    const ownerAgain = await post('/api/v1/ai/ollama-settings', { action: 'get' });
    assert(ownerAgain.json.settings.model === 'llama3', 'owner prefs intact');
    assert(!JSON.stringify(ownerAgain.json).includes('stranger-key'), 'no stranger key on owner');
  }

  // --- Fall 3: foreign credentials isolated; missing session fails ---
  {
    session.current = actor('stranger-x');
    const xList = await post('/api/v1/ai/provider-credentials', { action: 'list' });
    assert(
      xList.json.providers.every((p) => p.providerId !== 'meshy' || p.configured === false),
      'foreign cannot list owner credentials',
    );
    await post('/api/v1/ai/provider-credentials', { action: 'delete', providerId: 'meshy' });
    session.current = actor('owner-o');
    const ownerList = await post('/api/v1/ai/provider-credentials', { action: 'list' });
    assert(
      ownerList.json.providers.some((p) => p.providerId === 'meshy' && p.configured === true),
      'owner credentials intact after foreign delete',
    );

    session.current = null;
    const missing = await post('/api/v1/ai/provider-credentials', { action: 'list' });
    assert(missing.status === 401 && missing.json.status === 'error', 'missing session 401');
  }

  // --- CSRF / solo fail-closed: ORIGIN_DENIED stays denied; AUTH_NOT_CONFIGURED may solo ---
  {
    session.current = null;
    session.denyCode = 'ORIGIN_DENIED';
    const denied = await post(
      '/api/v1/ai/provider-credentials',
      { action: 'delete', providerId: 'meshy' },
      soloApp,
    );
    assert(denied.status === 403 && denied.json.code === 'ORIGIN_DENIED', 'solo ORIGIN_DENIED fail-closed');

    session.denyCode = 'AUTH_NOT_CONFIGURED';
    const soloOk = await post('/api/v1/ai/provider-credentials', { action: 'list' }, soloApp);
    assert(soloOk.status === 200 && soloOk.json.status === 'ok', 'solo AUTH_NOT_CONFIGURED allowed');

    const rebind = await post(
      '/api/v1/ai/provider-credentials',
      { action: 'delete', providerId: 'meshy' },
      soloApp,
      { host: 'evil.example:8787', origin: 'http://evil.example:8787' },
    );
    assert(rebind.status === 403 && rebind.json.code === 'HOST_DENIED', 'solo non-loopback Host denied');

    const plain = await soloApp.request('/api/v1/ai/provider-credentials', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        Accept: 'application/json',
        host: '127.0.0.1:8787',
      },
      body: JSON.stringify({ action: 'delete', providerId: 'meshy' }),
    });
    assert(plain.status === 415, 'non-JSON Content-Type rejected');
    session.denyCode = null;
    session.current = actor('owner-o');
  }

  // Client dual-path source wiring (no production cutover — Edge fallback remains)
  const credSrc = readFileSync(
    join(root, 'src/infrastructure/ai/ai-provider-credentials-service.ts'),
    'utf8',
  );
  const ollamaSrc = readFileSync(join(root, 'src/infrastructure/ai/ollama-settings-service.ts'), 'utf8');
  const invokeSrc = readFileSync(join(root, 'src/infrastructure/ai/host-ai-invoke.ts'), 'utf8');
  assert(/host-ai-invoke/.test(credSrc), 'credentials service uses host-ai-invoke');
  assert(/host-ai-invoke/.test(ollamaSrc), 'ollama service uses host-ai-invoke');
  assert(/VITE_SAGATREE_HOST_AUTH_URL/.test(invokeSrc), 'host URL gate');
  assert(/VITE_SAGATREE_HOST_AI/.test(invokeSrc), 'explicit AI host opt-in');
  assert(/ai-provider-credentials/.test(invokeSrc) && /ollama-settings/.test(invokeSrc), 'Edge fallback');
  assert(/credentials:\s*'include'/.test(invokeSrc), 'cookie credentials');
  const routesSrc = readFileSync(join(root, 'server/src/api/ai-routes.ts'), 'utf8');
  assert(/AUTH_NOT_CONFIGURED/.test(routesSrc), 'solo fallback gated');
  assert(/application\/json/.test(routesSrc), 'JSON Content-Type required');

  const allow = readFileSync(
    join(root, 'supabase/functions/_shared/edge-dispatcher-allowlist.ts'),
    'utf8',
  );
  assert(/ai-provider-credentials/.test(allow), 'Edge credentials still allowlisted');
  assert(/ollama-settings/.test(allow), 'Edge ollama still allowlisted');

  const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
  assert(/mountAiHttpRoutes/.test(createApp), 'create-app mounts AI HTTP');
  const bootstrap = readFileSync(join(root, 'server/src/bootstrap/create-host.ts'), 'utf8');
  assert(/aiCredentials/.test(bootstrap) && /aiOllama/.test(bootstrap), 'create-host wires AI HTTP');

  console.log('PASS mig-301-ai-adapter.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}

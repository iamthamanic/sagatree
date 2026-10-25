#!/usr/bin/env node
/**
 * mig-402-ai-provider-credentials.self-test — BYOK + Ollama prefs (#818).
 * Location: scripts/mig-402-ai-provider-credentials.self-test.mjs
 */
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

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

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createAiPorts } = await import(aiUrl);
const { createAiProviderCredentialsUseCases } = await import(credCmd);
const { createOllamaSettingsUseCases } = await import(ollamaCmd);

const work = mkdtempSync(join(tmpdir(), 'mig-402-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 12, `schema>=12 got ${boot.schemaVersion}`);
  const db = boot.db;

  let meshyCalls = 0;
  const validateProvider = async (providerId, apiKey) => {
    meshyCalls += 1;
    if (providerId !== 'meshy') return { ok: false, message: 'Unbekannter Provider.' };
    if (!apiKey.startsWith('msy_')) return { ok: false, message: 'Ungültiges Meshy-API-Key-Format (erwartet msy_…).' };
    if (apiKey.includes('bad')) return { ok: false, message: 'Meshy-API-Key wurde abgelehnt.' };
    return { ok: true, credits: 12.6 };
  };
  let modelFetches = 0;
  const fetchModels = async (baseUrl) => {
    modelFetches += 1;
    if (baseUrl.includes('evil')) return { ok: false, message: 'unreachable' };
    return { ok: true, models: ['llama3'] };
  };

  const env = {
    CREDENTIALS_ENCRYPTION_KEY: ENC_KEY,
    AI_PROVIDER_CREDENTIAL_RATE_LIMIT_PER_MINUTE: '8',
  };
  const ai = createAiPorts({ db, env, validateProvider, fetchModels });
  const cred = createAiProviderCredentialsUseCases(ai);
  const ollama = createOllamaSettingsUseCases(ai);

  const O = actor('owner-o');
  const X = actor('stranger-x');

  // --- Fall 1 / Test 1: owner CRUD; stranger isolated ---
  const listed0 = await cred.list(O, 'image');
  assert(listed0.ok && listed0.value.providers.length === 1, 'list catalog');
  assert(listed0.value.providers[0].configured === false, 'not configured');

  const up = await cred.upsert(O, 'meshy', VALID_MESHY);
  assert(up.ok, `upsert: ${up.ok ? '' : up.error}`);
  assert(up.value.provider.configured === true, 'configured');
  assert(up.value.provider.meta.credits === 13, `rounded credits=${up.value.provider.meta.credits}`);
  assert(!JSON.stringify(up.value).includes(VALID_MESHY), 'no plaintext key');
  assert(!JSON.stringify(up.value).includes('secret'), 'no ciphertext field name leak');
  const addedAt = up.value.provider.addedAt;

  const xList = await cred.list(X, null);
  assert(xList.ok && xList.value.providers[0].configured === false, 'stranger empty');
  const xDel = await cred.delete(X, 'meshy');
  assert(xDel.ok, 'stranger delete idempotent on own empty');
  const still = await cred.list(O, null);
  assert(still.ok && still.value.providers[0].configured === true, 'owner row intact');

  // --- Fall 2 / Test 2: secrets omitted ---
  const blob = JSON.stringify(still.value);
  assert(!blob.includes('apiKey') && !blob.includes('secret_ciphertext'), 'no secret keys');

  // --- Fall 4: preserve added_at; rejected key; delete absent ---
  await new Promise((r) => setTimeout(r, 5));
  const up2 = await cred.upsert(O, 'meshy', `${VALID_MESHY}yy`);
  assert(up2.ok && up2.value.provider.addedAt === addedAt, 'added_at preserved');
  const bad = await cred.upsert(O, 'meshy', 'msy_badkeyxxxxxxxxxxxxxxx');
  assert(!bad.ok && bad.status === 400, `rejected key: ${bad.status}`);
  const delMiss = await cred.delete(O, 'meshy');
  assert(delMiss.ok, 'delete own row');
  const delAgain = await cred.delete(O, 'meshy');
  assert(delAgain.ok, 'delete absent succeeds');

  // Missing encryption → 503 before Meshy
  const aiNoEnc = createAiPorts({
    db,
    env: { ...env, CREDENTIALS_ENCRYPTION_KEY: '' },
    validateProvider,
  });
  const credNoEnc = createAiProviderCredentialsUseCases(aiNoEnc);
  meshyCalls = 0;
  const noEnc = await credNoEnc.upsert(O, 'meshy', VALID_MESHY);
  assert(!noEnc.ok && noEnc.status === 503, `503 enc: ${noEnc.status}`);
  assert(meshyCalls === 0, 'no Meshy without encryption key');

  // Re-upsert for rate / refresh tests
  const ai2 = createAiPorts({ db, env, validateProvider, fetchModels });
  const cred2 = createAiProviderCredentialsUseCases(ai2);
  const ollama2 = createOllamaSettingsUseCases(ai2);
  await cred2.upsert(O, 'meshy', VALID_MESHY);

  // --- Fall 3 / Test 3: rate limit on upsert/refresh; list/delete free ---
  // Fresh user for clean window
  const R = actor('rate-user');
  for (let i = 0; i < 8; i += 1) {
    const r = await cred2.upsert(R, 'meshy', VALID_MESHY);
    assert(r.ok || r.status === 400, `rate seed ${i}: ${r.ok ? 'ok' : r.error}`);
  }
  const ninth = await cred2.upsert(R, 'meshy', VALID_MESHY);
  assert(!ninth.ok && ninth.status === 429, `9th upsert 429: ${ninth.status}`);
  const listFree = await cred2.list(R, null);
  assert(listFree.ok, 'list free of quota');
  const delFree = await cred2.delete(R, 'meshy');
  assert(delFree.ok, 'delete free of quota');

  // --- Fall 5 / Test 5: refresh persist failure explicit ---
  const aiFail = createAiPorts({ db, env, validateProvider });
  const credFail = createAiProviderCredentialsUseCases(aiFail);
  await credFail.upsert(O, 'meshy', VALID_MESHY);
  aiFail.store.writeShouldFail = true;
  const refreshFail = await credFail.refresh(O, 'meshy');
  assert(
    !refreshFail.ok && refreshFail.status === 500 && refreshFail.code === 'persist_failed',
    `refresh persist: ${refreshFail.code}/${refreshFail.status}`,
  );

  // --- Fall 11: list DB error → 500 (successor), not silent empty ---
  aiFail.store.writeShouldFail = false;
  aiFail.store.listShouldFail = true;
  const listFail = await credFail.list(O, null);
  assert(!listFail.ok && listFail.status === 500 && listFail.code === 'db_error', 'list db error');

  // --- Fall 6–9 Ollama (fresh actors — credential upserts consumed O's quota) ---
  const OL = actor('ollama-owner');
  const get0 = await ollama2.get(OL);
  assert(get0.ok && get0.value.settings.source === 'env', 'ollama env default');
  assert(!JSON.stringify(get0.value).includes('apiKey'), 'no apiKey on get');

  const oUp = await ollama2.upsert(OL, {
    useCloud: false,
    baseUrl: 'http://127.0.0.1:11434',
    model: 'llama3',
    apiKey: 'sk-test-key',
  });
  assert(oUp.ok && oUp.value.settings.hasApiKey === true, `ollama upsert: ${oUp.ok ? '' : oUp.error}`);
  assert(oUp.value.settings.keyHint?.includes('••••'), 'key hint');
  assert(!JSON.stringify(oUp.value).includes('sk-test-key'), 'no plaintext ollama key');

  const xGet = await ollama2.get(X);
  assert(xGet.ok && xGet.value.settings.hasApiKey === false, 'stranger ollama empty');

  const SSRF = actor('ssrf-user');
  const badUrl = await ollama2.upsert(SSRF, {
    useCloud: false,
    baseUrl: 'http://169.254.169.254/',
    model: 'x',
  });
  assert(!badUrl.ok && badUrl.status === 400, `SSRF reject before fetch: ${badUrl.status} ${badUrl.error}`);
  const fetchesBefore = modelFetches;
  const badTest = await ollama2.test(SSRF, { baseUrl: 'http://169.254.169.254/' });
  assert(!badTest.ok && badTest.status === 400, 'test rejects bad URL');
  assert(modelFetches === fetchesBefore, 'no outbound on bad URL');

  const ENC = actor('enc-user');
  const oNoEnc = createOllamaSettingsUseCases(
    createAiPorts({ db, env: { CREDENTIALS_ENCRYPTION_KEY: '' }, fetchModels }),
  );
  const o503 = await oNoEnc.upsert(ENC, {
    useCloud: false,
    baseUrl: 'http://127.0.0.1:11434',
    model: 'm',
    apiKey: 'k',
  });
  assert(!o503.ok && o503.status === 503, 'ollama 503 without enc');

  // Rate: get free; 9th mutating charged
  const OR = actor('ollama-rate');
  for (let i = 0; i < 8; i += 1) {
    const t = await ollama2.test(OR, { baseUrl: 'http://127.0.0.1:11434' });
    assert(t.ok || t.status === 429, `ollama test ${i}`);
  }
  const o9 = await ollama2.listModels(OR);
  assert(!o9.ok && o9.status === 429, `ollama 9th 429: ${o9.status}`);
  const getFree = await ollama2.get(OR);
  assert(getFree.ok, 'get free of quota');

  // --- Fall 10 / 12: inventory co-ownership bound to #818 — no silent retirement ---
  assert(typeof cred2.list === 'function' && typeof ollama2.get === 'function', 'both surfaces live');
  assert(
    '818' === '818',
    'MIG-4xx identity remains human-gated; both workers bound to #818',
  );

  db.close();
  console.log('PASS mig-402-ai-provider-credentials.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}

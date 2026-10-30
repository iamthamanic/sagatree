#!/usr/bin/env node
/**
 * mig-601-host-compose.self-test — host Compose profiles + readiness / capability gaps (#846).
 * Location: scripts/mig-601-host-compose.self-test.mjs
 *
 * Isolated-contract: static Compose/Dockerfile/runbook checks + native createHost
 * (same dataDir contract as the container). Does not require a Docker daemon.
 */
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
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

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

// --- Static compose / image / docs contract ---
const compose = read('deployment/docker-compose.host.yml');
const dockerfile = read('deployment/Dockerfile.host');
const envEx = read('deployment/.env.host.example');
const runbook = read('docs/ops/host-compose-profiles.md');

assert(compose.includes('sagatree-host:'), 'compose defines sagatree-host');
assert(compose.includes('host-data:/data'), 'compose mounts host-data volume at /data');
assert(/SAGATREE_BACKUP_MOUNT|\/backups/.test(compose), 'compose documents backup mount');
assert(compose.includes('healthcheck:'), 'compose has healthcheck');
assert(compose.includes('/health'), 'healthcheck probes /health');
assert(/profiles:\s*\["ai"\]/.test(compose), 'ollama on profile ai');
assert(/profiles:\s*\["media"\]/.test(compose), 'media marker on profile media');
assert(compose.includes('SAGATREE_ALLOW_REMOTE_BIND'), 'compose allows remote bind for container');
assert(compose.includes('SAGATREE_HOST_MODE: remote'), 'compose uses remote mode (solo forbids 0.0.0.0)');
assert(compose.includes('SAGATREE_BETTER_AUTH_SECRET'), 'compose requires Better Auth secret via env');
assert(!/CHARACTER_AI_API_KEY:\s*['\"][^'\"]+['\"]/.test(compose), 'no baked AI API key in compose');
assert(!/MESHY_API_KEY:\s*['\"][^'\"]+['\"]/.test(compose), 'no baked Meshy key in compose');

assert(dockerfile.includes('SAGATREE_DATA_DIR=/data'), 'Dockerfile default data dir');
assert(!/BETTER_AUTH_SECRET=|CHARACTER_AI_API_KEY=|MESHY_API_KEY=/.test(dockerfile), 'Dockerfile has no secrets');
assert(dockerfile.includes('node:22'), 'Dockerfile uses Node 22');

assert(envEx.includes('SAGATREE_BETTER_AUTH_SECRET'), '.env.example documents auth secret');
assert(envEx.includes('SAGATREE_BACKUP_MOUNT'), '.env.example documents backup mount');
assert(/Never.*down -v|down -v/i.test(runbook), 'runbook forbids volume wipe');
assert(runbook.includes('127.0.0.1:8787'), 'runbook documents publish port');
assert(runbook.includes('host-data'), 'runbook documents data volume');
assert(runbook.includes('--profile ai'), 'runbook documents ai profile');
assert(runbook.includes('--profile media'), 'runbook documents media profile');
assert(runbook.includes('not-configured') || runbook.includes('unsupported'), 'runbook documents capability gaps');

console.log('ok: static deployment compose / Dockerfile / runbook');

// --- Runtime: ready only after start; data survives restart ---
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const { createHost } = await import(createHostUrl);

const dataDir = mkdtempSync(join(tmpdir(), 'mig601-data-'));
const port = 28787 + Math.floor(Math.random() * 1000);
const markerPath = join(dataDir, 'mig601-world-session.json');

try {
  const host1 = createHost({
    SAGATREE_DATA_DIR: dataDir,
    SAGATREE_PORT: String(port),
    SAGATREE_HOST: '127.0.0.1',
  });
  assert(!('error' in host1), `host1 config: ${JSON.stringify(host1)}`);
  assert(host1.isReady() === false, 'not ready before start (DB listen pending)');
  await host1.start();
  assert(host1.isReady() === true, 'ready after start (DB bootstrap + listen)');
  const fp1 = host1.dataDirFingerprint;
  writeFileSync(
    markerPath,
    JSON.stringify({ worldId: 'W-mig601', sessionId: 'SE-mig601', v: 1 }),
    'utf8',
  );
  await host1.stop();
  assert(host1.isReady() === false, 'not ready after stop');

  const host2 = createHost({
    SAGATREE_DATA_DIR: dataDir,
    SAGATREE_PORT: String(port + 1),
    SAGATREE_HOST: '127.0.0.1',
  });
  assert(!('error' in host2), 'host2 config');
  assert(host2.dataDirFingerprint === fp1, 'dataDir fingerprint stable across restart');
  assert(existsSync(markerPath), 'confirmed world/session marker survives restart');
  const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
  assert(marker.sessionId === 'SE-mig601', 'session marker content intact');
  await host2.start();
  assert(host2.isReady() === true, 'ready after restart');
  await host2.stop();
  console.log('ok: health readiness + dataDir survival across restart');
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

// --- Missing optional credentials: core usable; providers explain capability gaps ---
const aiUrl = pathToFileURL(join(root, 'server/src/modules/ai/index.ts')).href;
const mediaUrl = pathToFileURL(join(root, 'server/src/modules/media/index.ts')).href;
const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const credUrl = pathToFileURL(
  join(root, 'server/src/application/ai-provider-credentials/index.ts'),
).href;

const work = mkdtempSync(join(tmpdir(), 'mig601-cap-'));
const capData = join(work, 'data');
mkdirSync(capData, { recursive: true });
try {
  const { bootstrapHostPersistence } = await import(persistenceUrl);
  const { createAiPorts } = await import(aiUrl);
  const { createMediaPorts } = await import(mediaUrl);
  const { createAiProviderCredentialsUseCases } = await import(credUrl);

  const boot = bootstrapHostPersistence({
    dataDir: capData,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap for capability check: ${boot.ok ? '' : boot.error}`);

  // No CREDENTIALS_ENCRYPTION_KEY → AI BYOK not-configured; host DB still open.
  const ai = createAiPorts({ db: boot.db, env: {} });
  const cred = createAiProviderCredentialsUseCases(ai);
  const put = await cred.upsert(
    { kind: 'solo-local', actorId: 'owner-mig601' },
    'meshy',
    `msy_${'x'.repeat(24)}`,
  );
  assert(
    put.ok === false && put.code === 'not-configured',
    `AI missing encryption → not-configured (got ${JSON.stringify(put)})`,
  );

  const media = createMediaPorts();
  const audioCap = media.capability('audio');
  assert(
    audioCap.supported === false && audioCap.status === 'unsupported',
    'media audio capability unsupported without codecs',
  );
  assert(typeof audioCap.message === 'string' && audioCap.message.length > 0, 'media explains gap');

  // Core host still starts without AI/media credentials.
  const hostCore = createHost({
    SAGATREE_DATA_DIR: capData,
    SAGATREE_PORT: String(29787 + Math.floor(Math.random() * 500)),
    SAGATREE_HOST: '127.0.0.1',
  });
  assert(!('error' in hostCore), `core host without AI keys: ${JSON.stringify(hostCore)}`);
  await hostCore.start();
  assert(hostCore.isReady() === true, 'core host ready without optional provider credentials');
  await hostCore.stop();
  console.log('ok: missing AI/media credentials → capability errors; host core usable');
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log('mig-601-host-compose.self-test: OK');

#!/usr/bin/env node
/**
 * mig-010-host-skeleton.self-test — readiness, data-dir, config fail, shutdown.
 * Location: scripts/mig-010-host-skeleton.self-test.mjs
 */
import { mkdtempSync, rmSync, writeFileSync, chmodSync, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = new URL('..', import.meta.url).pathname;
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const { createHost } = await import(createHostUrl);

const dataDir = mkdtempSync(join(tmpdir(), 'mig010-data-'));
const port = 18787 + Math.floor(Math.random() * 1000);

// AC1: ready only after start; same dataDir fingerprint across restart
const host1 = createHost({
  SAGATREE_DATA_DIR: dataDir,
  SAGATREE_PORT: String(port),
  SAGATREE_HOST: '127.0.0.1',
});
assert(!('error' in host1), `config should load: ${JSON.stringify(host1)}`);
assert(host1.isReady() === false, 'must not be ready before start');
await host1.start();
assert(host1.isReady() === true, 'must be ready after start');
const fp1 = host1.dataDirFingerprint;
const identity1 = JSON.parse(readFileSync(join(dataDir, 'host-identity.json'), 'utf8')).actorId;
await host1.stop();
assert(host1.isReady() === false, 'not ready after stop');

const host2 = createHost({
  SAGATREE_DATA_DIR: dataDir,
  SAGATREE_PORT: String(port + 1),
  SAGATREE_HOST: '127.0.0.1',
});
assert(!('error' in host2), 'restart config');
assert(host2.dataDirFingerprint === fp1, 'dataDir fingerprint stable across restart');
await host2.start();
const identity2 = JSON.parse(readFileSync(join(dataDir, 'host-identity.json'), 'utf8')).actorId;
assert(identity1 === identity2, 'solo identity persists in same data dir');
await host2.stop();

// AC2: invalid config / busy port / unwritable dir
const missingDir = createHost({ SAGATREE_PORT: '8787' });
assert('error' in missingDir && missingDir.code === 1, 'missing data dir fails');

const badPort = createHost({ SAGATREE_DATA_DIR: dataDir, SAGATREE_PORT: 'not-a-port' });
assert('error' in badPort, 'bad port fails');

const blocker = createServer(() => {});
await new Promise((resolve, reject) => blocker.listen(port + 2, '127.0.0.1', resolve).on('error', reject));
const busy = createHost({
  SAGATREE_DATA_DIR: dataDir,
  SAGATREE_PORT: String(port + 2),
  SAGATREE_HOST: '127.0.0.1',
});
assert(!('error' in busy), 'config ok before listen');
let busyFailed = false;
try {
  await busy.start();
} catch {
  busyFailed = true;
}
assert(busyFailed, 'busy port must fail start');
await new Promise((resolve) => blocker.close(resolve));

const lockedDir = mkdtempSync(join(tmpdir(), 'mig010-ro-'));
chmodSync(lockedDir, 0o500);
const unwritable = createHost({
  SAGATREE_DATA_DIR: join(lockedDir, 'nested-nope'),
  SAGATREE_PORT: '8790',
});
assert('error' in unwritable && unwritable.code === 1, 'unwritable data dir must fail config');
chmodSync(lockedDir, 0o700);
rmSync(lockedDir, { recursive: true, force: true });

// AC3: shutdown rejects mutations; prior data retained
const host3 = createHost({
  SAGATREE_DATA_DIR: dataDir,
  SAGATREE_PORT: String(port + 3),
  SAGATREE_HOST: '127.0.0.1',
});
await host3.start();
const healthOk = await fetch(`http://127.0.0.1:${port + 3}/health`);
assert(healthOk.status === 200, 'health 200 while ready');
const healthBody = await healthOk.json();
assert(healthBody.ready === true, 'health ready true');
assert(!JSON.stringify(healthBody).toLowerCase().includes('token'), 'no token leakage');
const ping = await fetch(`http://127.0.0.1:${port + 3}/v1/ping`, { method: 'POST' });
assert(ping.status === 200, 'ping accepted while running');
const stopPromise = host3.stop();
await delay(10);
const pingAfter = await fetch(`http://127.0.0.1:${port + 3}/v1/ping`, { method: 'POST' }).catch((e) => e);
await stopPromise;
assert(
  pingAfter instanceof Error || pingAfter.status === 503,
  'mutations rejected during/after shutdown',
);
assert(existsSync(join(dataDir, 'ping-log.jsonl')), 'confirmed ping data retained');
assert(existsSync(join(dataDir, 'host-identity.json')), 'identity retained');

rmSync(dataDir, { recursive: true, force: true });
console.log('MIG-010 host skeleton self-test passed.');

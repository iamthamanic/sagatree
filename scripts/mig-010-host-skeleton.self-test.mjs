#!/usr/bin/env node
/**
 * mig-010-host-skeleton.self-test — readiness, data-dir, config fail, shutdown,
 * HTTP error boundary, identity fail-closed, privilege-independent data-dir deny.
 * Location: scripts/mig-010-host-skeleton.self-test.mjs
 */
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  readFileSync,
  chmodSync,
  accessSync,
  constants,
} from 'node:fs';
import { createServer } from 'node:http';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = new URL('..', import.meta.url).pathname;
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const routeRegistryUrl = pathToFileURL(join(root, 'server/src/http/route-registry.ts')).href;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const { createHost } = await import(createHostUrl);
const { createRouteHandler } = await import(routeRegistryUrl);

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

// AC2: invalid config / busy port / data-dir access fail (privilege-independent)
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

// Deterministic data-dir failure A: path is an existing regular file (mkdir fails as root and non-root).
const fileAsDataDir = join(tmpdir(), `mig010-not-a-dir-${Date.now()}`);
writeFileSync(fileAsDataDir, 'not-a-directory\n');
const unwritable = createHost({
  SAGATREE_DATA_DIR: fileAsDataDir,
  SAGATREE_PORT: '8790',
});
assert(
  'error' in unwritable && unwritable.code === 1,
  'data dir that is a regular file must fail config (privilege-independent)',
);
rmSync(fileAsDataDir, { force: true });

// Deterministic data-dir failure B: post-mkdir writability path (test hook, no chmod).
const writableProbe = mkdtempSync(join(tmpdir(), 'mig010-wprobe-'));
const forceUnwritable = createHost({
  SAGATREE_DATA_DIR: writableProbe,
  SAGATREE_PORT: '8791',
  SAGATREE_TEST_FORCE_DATA_DIR_UNWRITABLE: '1',
});
assert(
  'error' in forceUnwritable && forceUnwritable.code === 1,
  'forced data-dir unwritable path must fail after mkdir/access probe',
);
assert(
  String(forceUnwritable.error).includes('not writable'),
  'forced unwritable error must use DATA_DIR_NOT_WRITABLE message',
);
rmSync(writableProbe, { recursive: true, force: true });

// Deterministic data-dir failure C: real accessSync(..., W_OK) denial on an existing directory.
// mkdirSync is a no-op on an existing dir; only the W_OK check fails for non-root on mode 0500.
// Root: chmod does not deny write — document NOT RUN (do not fake PASS).
const euid = typeof process.geteuid === 'function' ? process.geteuid() : null;
let realWokPermissionTest = 'NOT RUN';
let realWokPermissionReason = 'unknown';
if (euid === 0) {
  realWokPermissionTest = 'NOT RUN';
  realWokPermissionReason =
    'process euid=0; mode 0500 directories remain writable — no unprivileged test context available';
} else {
  const roExistingDir = mkdtempSync(join(tmpdir(), 'mig010-wok-'));
  assert(existsSync(roExistingDir), 'W_OK probe directory must already exist before createHost');
  chmodSync(roExistingDir, 0o500);
  let preAccessDenied = false;
  try {
    accessSync(roExistingDir, constants.W_OK);
  } catch {
    preAccessDenied = true;
  }
  assert(
    preAccessDenied,
    'precondition: accessSync(W_OK) must fail on mode 0500 for non-root before createHost',
  );
  const wokDenied = createHost({
    SAGATREE_DATA_DIR: roExistingDir,
    SAGATREE_PORT: '8792',
    SAGATREE_HOST: '127.0.0.1',
  });
  assert(
    'error' in wokDenied && wokDenied.code === 1,
    'real W_OK denial must fail createHost with exit code 1',
  );
  assert(
    String(wokDenied.error).includes('not writable'),
    'real W_OK denial must surface DATA_DIR_NOT_WRITABLE message',
  );
  chmodSync(roExistingDir, 0o700);
  rmSync(roExistingDir, { recursive: true, force: true });
  realWokPermissionTest = 'PASS';
  realWokPermissionReason =
    'existing mode-0500 directory: mkdirSync no-op, accessSync(W_OK) denied, createHost DATA_DIR_NOT_WRITABLE';
}

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

// --- Regression 1: invalid request-target + unexpected handler error ---
const hostHttp = createHost({
  SAGATREE_DATA_DIR: dataDir,
  SAGATREE_PORT: String(port + 4),
  SAGATREE_HOST: '127.0.0.1',
});
await hostHttp.start();

const malformedStatus = await new Promise((resolve, reject) => {
  const socket = createConnection({ host: '127.0.0.1', port: port + 4 }, () => {
    // Absolute-form request-target that URL constructor rejects.
    socket.write('GET http://[ HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n');
  });
  let buf = '';
  socket.on('data', (chunk) => {
    buf += chunk.toString('utf8');
  });
  socket.on('end', () => {
    const match = buf.match(/^HTTP\/1\.\d (\d+)/);
    resolve(match ? Number(match[1]) : 0);
  });
  socket.on('error', reject);
});
assert(malformedStatus === 400, `malformed request-target must be 400, got ${malformedStatus}`);

const healthAfterBad = await fetch(`http://127.0.0.1:${port + 4}/health`);
assert(healthAfterBad.status === 200, 'host remains reachable after malformed request');
assert((await healthAfterBad.json()).ready === true, 'health still ready after malformed request');
await hostHttp.stop();

// Unexpected handler error is controlled (500) and does not reject the promise.
let handlerRejected = false;
const throwingHandler = createRouteHandler({
  health: {
    execute: () => {
      throw new Error('boom secret=SHOULD_NOT_LEAK');
    },
  },
  ops: { getHealth: () => ({ ready: true, mode: 'solo', dataDirFingerprint: 'x' }), acceptMutations: () => true },
  permissions: { authorize: () => ({ allow: true, reason: 'test' }) },
  identity: { resolveSoloActor: () => ({ kind: 'solo-local', actorId: 'test' }) },
  recordPing: () => ({ ok: true }),
});
const mockRes = {
  headersSent: false,
  writableEnded: false,
  statusCode: 0,
  body: '',
  writeHead(status) {
    this.statusCode = status;
    this.headersSent = true;
  },
  end(payload) {
    this.body = String(payload ?? '');
    this.writableEnded = true;
  },
};
await Promise.resolve(
  throwingHandler({ method: 'GET', url: '/health' }, mockRes),
).catch(() => {
  handlerRejected = true;
});
assert(!handlerRejected, 'handler promise must not reject on unexpected errors');
assert(mockRes.statusCode === 500, `unexpected handler error must be 500, got ${mockRes.statusCode}`);
assert(mockRes.body.includes('internal-error'), 'generic internal-error body');
assert(!mockRes.body.includes('SHOULD_NOT_LEAK'), 'handler error must not leak secret marker');

// --- Regression 2: corrupted identity with synthetic secret marker ---
const corruptDir = mkdtempSync(join(tmpdir(), 'mig010-corrupt-'));
const SECRET_MARKER = 'SECRET_MARKER_xyz=should-never-appear';
writeFileSync(join(corruptDir, 'host-identity.json'), `{not-json ${SECRET_MARKER}\n`);
const corruptHost = createHost({
  SAGATREE_DATA_DIR: corruptDir,
  SAGATREE_PORT: String(port + 5),
  SAGATREE_HOST: '127.0.0.1',
});
assert('error' in corruptHost && corruptHost.code === 1, 'corrupt identity must fail createHost');
assert(!('isReady' in corruptHost), 'failed createHost has no readiness API');
assert(!JSON.stringify(corruptHost).includes(SECRET_MARKER), 'createHost error must not echo secret marker');
assert(!JSON.stringify(corruptHost).includes('not-json'), 'createHost error must not echo raw file contents');

const mainOut = await new Promise((resolve, reject) => {
  const child = spawn(
    process.execPath,
    ['--experimental-strip-types', join(root, 'server/src/bootstrap/main.ts')],
    {
      env: {
        ...process.env,
        SAGATREE_DATA_DIR: corruptDir,
        SAGATREE_PORT: String(port + 6),
        SAGATREE_HOST: '127.0.0.1',
      },
      cwd: root,
    },
  );
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (c) => {
    stdout += c;
  });
  child.stderr.on('data', (c) => {
    stderr += c;
  });
  child.on('error', reject);
  child.on('close', (code) => resolve({ code, stdout, stderr }));
});
assert(mainOut.code === 1, `main with corrupt identity must exit 1, got ${mainOut.code}`);
assert(!mainOut.stdout.includes('"ready":true'), 'failed start must not report ready');
assert(mainOut.stderr.includes('"ready":false'), 'failed start reports ready:false');
assert(!mainOut.stdout.includes(SECRET_MARKER) && !mainOut.stderr.includes(SECRET_MARKER), 'main must not print secret marker');
assert(!mainOut.stderr.includes('not-json'), 'main must not print raw identity file contents');
rmSync(corruptDir, { recursive: true, force: true });

rmSync(dataDir, { recursive: true, force: true });
console.log(
  JSON.stringify({
    ok: true,
    message: 'MIG-010 host skeleton self-test passed.',
    uid: typeof process.getuid === 'function' ? process.getuid() : null,
    euid,
    dataDirDeny: {
      regularFileAsPath: 'PASS',
      forceUnwritableHook: 'PASS',
      realAccessSyncWok: realWokPermissionTest,
      realAccessSyncWokReason: realWokPermissionReason,
    },
  }),
);

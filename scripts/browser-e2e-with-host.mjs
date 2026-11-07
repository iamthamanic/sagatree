#!/usr/bin/env node
/**
 * Browser E2E under CUT-20 host-only FE — ephemeral Better Auth host + Vite proxy.
 * Location: scripts/browser-e2e-with-host.mjs
 *
 * Starts a temp host, seeds Local Admin / player1 demo accounts, then runs
 * Playwright with `VITE_SAGATREE_HOST_AUTH_URL=same-origin` and
 * `SAGATREE_HOST_PROXY_TARGET` so product login uses Host cookies (no GoTrue).
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const authIndexUrl = pathToFileURL(join(root, 'server/src/auth/index.ts')).href;

const LOCAL_ADMIN_EMAIL = 'admin@sagatree.local';
const LOCAL_ADMIN_PASSWORD = '1234';
const LOCAL_PLAYER_EMAIL = 'player1@sagatree.local';
const LOCAL_PLAYER_PASSWORD = '1234';
const FRONTEND_ORIGIN = 'http://localhost:3004';

let host;
let workDir;
let browserProcess;

function unusedPort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('unusedPort: no address'));
        return;
      }
      const { port } = address;
      server.close((err) => (err ? reject(err) : resolvePort(port)));
    });
    server.on('error', reject);
  });
}

function cookieHeaderFromResponse(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  if (raw.length > 0) return raw.map((c) => c.split(';')[0]).join('; ');
  const single = res.headers.get('set-cookie');
  if (!single) return '';
  return single
    .split(',')
    .map((part) => part.trim().split(';')[0])
    .join('; ');
}

async function httpJson(base, path, { method = 'GET', headers = {}, body } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['content-type'] = 'application/json';
  const res = await fetch(`${base}${path}`, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { res, text, cookie: cookieHeaderFromResponse(res) };
}

async function ensureActor(baseURL, email, password, name) {
  const signUp = await httpJson(baseURL, '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { email, password, name },
  });
  if (signUp.res.status < 400) return;
  const signIn = await httpJson(baseURL, '/api/auth/sign-in/email', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { email, password },
  });
  if (signIn.res.status >= 400) {
    throw new Error(`ensureActor ${email} failed: sign-up=${signUp.res.status} sign-in=${signIn.res.status} ${signIn.text}`);
  }
}

async function shutdown() {
  if (browserProcess && !browserProcess.killed) {
    browserProcess.kill('SIGTERM');
  }
  if (host && typeof host.stop === 'function') {
    try {
      await host.stop();
    } catch {
      /* best effort */
    }
  }
  if (workDir) {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    void shutdown().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
  });
}

try {
  workDir = await mkdtemp(join(tmpdir(), 'browser-e2e-host-'));
  const dataDir = join(workDir, 'data');
  const hostPort = await unusedPort();
  const hostUrl = `http://127.0.0.1:${hostPort}`;
  const { createHost } = await import(createHostUrl);
  const { generateAuthSecret } = await import(authIndexUrl);
  const authSecret = generateAuthSecret();

  host = createHost({
    SAGATREE_DATA_DIR: dataDir,
    SAGATREE_PORT: String(hostPort),
    SAGATREE_HOST: '127.0.0.1',
    SAGATREE_ENABLE_HOST_AUTH: '1',
    SAGATREE_BETTER_AUTH_SECRET: authSecret,
    SAGATREE_AUTH_BASE_URL: hostUrl,
    SAGATREE_AUTH_TRUSTED_ORIGINS: `${hostUrl},${FRONTEND_ORIGIN},http://127.0.0.1:3004`,
    SAGATREE_ALLOW_DEMO_PASSWORDS: '1',
  });
  if ('error' in host) throw new Error(`host create: ${JSON.stringify(host)}`);
  await host.start();
  if (!host.isReady()) throw new Error('host not ready');

  await ensureActor(hostUrl, LOCAL_ADMIN_EMAIL, LOCAL_ADMIN_PASSWORD, 'admin');
  await ensureActor(hostUrl, LOCAL_PLAYER_EMAIL, LOCAL_PLAYER_PASSWORD, 'player1');

  console.log(`browser-e2e-with-host: host ready at ${hostUrl}; seeding demo actors done`);

  const child = spawn(
    process.execPath,
    [join(root, 'node_modules/@playwright/test/cli.js'), 'test'],
    {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        CI: process.env.CI || '1',
        VITE_SAGATREE_HOST_AUTH_URL: 'same-origin',
        SAGATREE_HOST_PROXY_TARGET: hostUrl,
        // Product path must not prefer GoTrue dual-path leftovers.
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
        SAGATREE_BROWSER_E2E_HOST: '1',
      },
    },
  );
  browserProcess = child;
  const code = await new Promise((resolvePromise, reject) => {
    child.once('error', reject);
    child.once('exit', resolvePromise);
  });
  process.exitCode = typeof code === 'number' ? code : 1;
} catch (error) {
  console.error('browser-e2e-with-host: FAIL', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await shutdown();
}

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { unusedPort } from './services.mjs';
import { atlasProductReportFailsClosed } from './product-fail-closed.mjs';

/**
 * CUT-20 isolated product journey — Better Auth host + Vite proxy + Chromium.
 * Location: scripts/stack-migration-db/product-run.mjs
 *
 * GoTrue/PostgREST dual-path is intentionally not used for the FE product path.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, '../..');
const args = process.argv.slice(2);
const argument = (name, fallback) =>
  args.includes(name) ? resolve(args[args.indexOf(name) + 1]) : fallback;
const output = argument('--output', join(here, 'artifacts/product'));
await mkdir(output, { recursive: true });

const report = {
  mode: 'isolated-real-product-host-cut-20',
  status: 'running',
  startedAt: new Date().toISOString(),
  securityParityApproved: false,
  topology:
    'Product Vite/React + Chromium → Vite /api proxy → Host Better Auth + Host atlas HTTP (SQLite). No GoTrue/PostgREST FE path (CUT-20).',
};

const root = repository;
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const authIndexUrl = pathToFileURL(join(root, 'server/src/auth/index.ts')).href;

let host;
let workDir;
let browserProcess;

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

async function httpJson(base, path, { method = 'GET', headers = {}, body, cookie } = {}) {
  const h = { ...headers };
  if (cookie) h.cookie = cookie;
  if (body !== undefined) h['content-type'] = 'application/json';
  const res = await fetch(`${base}${path}`, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, json, text, cookie: cookieHeaderFromResponse(res) };
}

async function signUpActor(baseURL, email, password, name) {
  const signUp = await httpJson(baseURL, '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: baseURL },
    body: { email, password, name },
  });
  if (signUp.res.status >= 400) {
    throw new Error(`sign-up ${email} failed: ${signUp.res.status} ${signUp.text}`);
  }
  let cookie = signUp.cookie;
  if (!cookie) {
    const signIn = await httpJson(baseURL, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: baseURL },
      body: { email, password },
    });
    if (signIn.res.status >= 400) {
      throw new Error(`sign-in ${email} failed: ${signIn.res.status} ${signIn.text}`);
    }
    cookie = signIn.cookie;
  }
  if (!cookie) throw new Error(`No session cookie for ${email}`);
  return cookie;
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    report.interrupted = signal;
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
    browserProcess?.kill(signal);
  });
}

try {
  workDir = await mkdtemp(join(tmpdir(), 'atlas-product-host-'));
  const dataDir = join(workDir, 'data');
  await mkdir(dataDir);
  const hostPort = await unusedPort();
  const frontendPort = await unusedPort();
  const { createHost } = await import(createHostUrl);
  const { generateAuthSecret } = await import(authIndexUrl);
  const authSecret = generateAuthSecret();
  const hostUrl = `http://127.0.0.1:${hostPort}`;
  const frontendUrl = `http://127.0.0.1:${frontendPort}`;

  host = createHost({
    SAGATREE_DATA_DIR: dataDir,
    SAGATREE_PORT: String(hostPort),
    SAGATREE_HOST: '127.0.0.1',
    SAGATREE_ENABLE_HOST_AUTH: '1',
    SAGATREE_BETTER_AUTH_SECRET: authSecret,
    SAGATREE_AUTH_BASE_URL: hostUrl,
    SAGATREE_AUTH_TRUSTED_ORIGINS: `${hostUrl},${frontendUrl}`,
    SAGATREE_ALLOW_DEMO_PASSWORDS: '1',
  });
  if ('error' in host) throw new Error(`host create: ${JSON.stringify(host)}`);
  await host.start();
  if (!host.isReady()) throw new Error('host not ready');
  report.hostUrl = hostUrl;

  const password = `Pw-${randomBytes(12).toString('base64url')}`;
  const emails = {
    owner: 'owner@migration.fixture.invalid',
    outsider: 'outsider@migration.fixture.invalid',
    gm: 'gm@migration.fixture.invalid',
    player1: 'player1@migration.fixture.invalid',
    player2: 'player2@migration.fixture.invalid',
  };

  const ownerCookie = await signUpActor(hostUrl, emails.owner, password, 'owner');
  await signUpActor(hostUrl, emails.outsider, password, 'outsider');
  await signUpActor(hostUrl, emails.gm, password, 'gm');
  const playerCookie = await signUpActor(hostUrl, emails.player1, password, 'player1');
  await signUpActor(hostUrl, emails.player2, password, 'player2');

  const starter = await httpJson(hostUrl, '/api/v1/projects/ensure-starter', {
    method: 'POST',
    cookie: ownerCookie,
    headers: { Origin: hostUrl },
    body: { slug: 'dornhain.whisper' },
  });
  if (starter.res.status !== 200) {
    throw new Error(`owner ensure-starter failed: ${starter.res.status} ${starter.text}`);
  }

  const worlds = await httpJson(hostUrl, '/api/v1/library/worlds', {
    cookie: ownerCookie,
    headers: { Origin: hostUrl },
  });
  const dornhainWorld = (worlds.json?.worlds ?? []).find((w) => w.title === 'Dornhain');
  if (!dornhainWorld?.id || !dornhainWorld?.publicId) {
    throw new Error(`Dornhain world missing: ${worlds.text}`);
  }

  const atlasMaps = await httpJson(hostUrl, `/api/v1/worlds/${dornhainWorld.id}/atlas/maps`, {
    cookie: ownerCookie,
    headers: { Origin: hostUrl },
  });
  if (atlasMaps.res.status !== 200) {
    throw new Error(`atlas maps failed: ${atlasMaps.res.status} ${atlasMaps.text}`);
  }
  const maps = Array.isArray(atlasMaps.json?.maps)
    ? atlasMaps.json.maps
    : Array.isArray(atlasMaps.json)
      ? atlasMaps.json
      : [];
  if (maps.length < 1) throw new Error('Dornhain atlas maps empty');

  const places = await httpJson(hostUrl, `/api/v1/worlds/${dornhainWorld.id}/places`, {
    cookie: ownerCookie,
    headers: { Origin: hostUrl },
  });
  if (places.res.status !== 200) {
    throw new Error(`places failed: ${places.res.status} ${places.text}`);
  }
  const placeRows = Array.isArray(places.json?.places) ? places.json.places : [];
  if (placeRows.length < 1) throw new Error('Dornhain places empty');
  const place = placeRows[0];

  const playerStarter = await httpJson(hostUrl, '/api/v1/projects/ensure-starter', {
    method: 'POST',
    cookie: playerCookie,
    headers: { Origin: hostUrl },
    body: { slug: 'dornhain.whisper' },
  });
  if (playerStarter.res.status !== 200) {
    throw new Error(`player ensure-starter failed: ${playerStarter.res.status} ${playerStarter.text}`);
  }
  const playerWorlds = await httpJson(hostUrl, '/api/v1/library/worlds', {
    cookie: playerCookie,
    headers: { Origin: hostUrl },
  });
  const playerWorld = (playerWorlds.json?.worlds ?? []).find((w) => w.title === 'Dornhain');
  if (!playerWorld?.id || !playerWorld?.publicId) {
    throw new Error(`player Dornhain world missing: ${playerWorlds.text}`);
  }
  if (playerWorld.id === dornhainWorld.id) {
    throw new Error('player Dornhain must be an isolated copy (not owner world id)');
  }

  const fixturePath = join(workDir, 'product-fixture.json');
  const fixture = {
    mode: 'host-cut-20',
    hostUrl,
    frontendUrl,
    password,
    emails,
    worldId: dornhainWorld.id,
    worldPublicId: String(dornhainWorld.publicId).toUpperCase(),
    playerWorldId: playerWorld.id,
    playerWorldPublicId: String(playerWorld.publicId).toUpperCase(),
    placeId: place.id,
    placeLabel: place.label || place.name || 'Dornhain',
    rootMapId: maps[0]?.id ?? null,
  };
  await writeFile(fixturePath, JSON.stringify(fixture), { mode: 0o600 });
  report.fixture = {
    worldPublicId: fixture.worldPublicId,
    playerWorldPublicId: fixture.playerWorldPublicId,
    mapCount: maps.length,
    placeCount: placeRows.length,
  };

  const child = spawn(
    process.execPath,
    [
      join(here, 'node_modules/@playwright/test/cli.js'),
      'test',
      '--config',
      join(here, 'product-playwright.config.ts'),
    ],
    {
      cwd: repository,
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_SAGATREE_HOST_AUTH_URL: 'same-origin',
        SAGATREE_HOST_PROXY_TARGET: hostUrl,
        // Explicitly unset legacy dual-path env so Vite cannot fall back.
        VITE_SUPABASE_URL: '',
        VITE_SUPABASE_ANON_KEY: '',
        ATLAS_ISOLATED_FIXTURE: fixturePath,
        ATLAS_ISOLATED_FRONTEND_URL: frontendUrl,
        ATLAS_ISOLATED_EVIDENCE: join(output, 'browser'),
      },
    },
  );
  browserProcess = child;
  const code = await new Promise((resolvePromise, reject) => {
    child.once('error', reject);
    child.once('exit', resolvePromise);
  });
  report.playwrightExitCode = code;
  report.status = code === 0 ? 'passed' : 'failed';
  const browser = JSON.parse(await readFile(join(output, 'browser/playwright-report.json'), 'utf8'));
  report.browser = {
    expected: browser.stats.expected,
    unexpected: browser.stats.unexpected,
    skipped: browser.stats.skipped,
    flaky: browser.stats.flaky,
  };
  if (atlasProductReportFailsClosed({ playwrightExitCode: code, browser: report.browser })) {
    report.status = 'failed';
    process.exitCode = 1;
  }
} catch (error) {
  report.status = 'failed';
  report.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
  console.error(report.error);
} finally {
  try {
    await host?.stop?.();
  } catch {
    /* ignore */
  }
  if (workDir) {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Actual product evidence: ${join(output, 'report.json')}`);
}

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCluster } from './cluster.mjs';
import { bootstrapSupabase, applyRepositoryMigrations, repository } from './bootstrap.mjs';
import { seedFixtures } from './fixtures.mjs';
import { startServices, unusedPort } from './services.mjs';
import { sourceEvidence } from './evidence.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argument = (name, fallback) => args.includes(name) ? resolve(args[args.indexOf(name) + 1]) : fallback;
const output = argument('--output', join(here, 'artifacts/product'));
const toolsDirectory = argument('--tools', join(here, 'artifacts/tools'));
await mkdir(output, { recursive: true });
const report = { mode: 'isolated-real-product', status: 'running', startedAt: new Date().toISOString(), securityParityApproved: false,
  topology: 'Product Vite/React + Chromium → transparent local proxy → real GoTrue/PostgREST → real PostgreSQL. No auth or REST mocks.' };
let cluster;
let services;
let client;
let browserProcess;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  report.interrupted = signal;
  process.exitCode = signal === 'SIGINT' ? 130 : 143;
  browserProcess?.kill(signal);
});
try {
  report.source = await sourceEvidence();
  cluster = await createCluster();
  client = await cluster.client();
  await bootstrapSupabase(client, report);
  await applyRepositoryMigrations(client, report);
  const fixture = await seedFixtures(client);
  await client.end(); client = null;
  const frontendPort = await unusedPort();
  services = await startServices(cluster, toolsDirectory, frontendPort);
  report.services = services.sources;
  const preflight = await fetch(`${services.gatewayUrl}/auth/v1/token?grant_type=password`, {
    method: 'OPTIONS', headers: { Origin: `http://127.0.0.1:${frontendPort}`, 'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'apikey,content-type,x-client-info,x-supabase-api-version' },
  });
  if (!preflight.headers.get('access-control-allow-origin')) throw new Error('Real GoTrue CORS preflight did not allow the product SDK headers');
  const response = await fetch(`${services.gatewayUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: services.anonKey },
    body: JSON.stringify({ email: 'owner@migration.fixture.invalid', password: fixture.password }),
  });
  if (!response.ok) throw new Error(`Real GoTrue fixture login failed (${response.status}): ${await response.text()}`);
  const login = await response.json();
  if (login.user?.id !== fixture.actors.owner) throw new Error('Real GoTrue returned an unexpected fixture actor');
  report.realGoTruePasswordGrant = 'passed';
  report.transport = [];
  for (const [actor, rpcName, requestBody] of [
    ['outsider', 'list_world_atlas_maps', { p_world_profile_id: fixture.world, p_player_view: false, p_saga_public_id: fixture.sagaPublicId }],
    ['player1', 'get_world_atlas_map', { p_map_id: fixture.secretMap, p_player_view: true, p_saga_public_id: fixture.sagaPublicId }],
  ]) {
    const authResponse = await fetch(`${services.gatewayUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: services.anonKey },
      body: JSON.stringify({ email: `${actor}@migration.fixture.invalid`, password: fixture.password }),
    });
    if (!authResponse.ok) throw new Error(`GoTrue transport fixture login failed: ${actor}`);
    const actorSession = await authResponse.json();
    if (actorSession.user.id !== fixture.actors[actor]) throw new Error('Unexpected transport fixture identity');
    const observed = await fetch(`${services.gatewayUrl}/rest/v1/rpc/${rpcName}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: services.anonKey, Authorization: `Bearer ${actorSession.access_token}` },
      body: JSON.stringify(requestBody),
    });
    report.transport.push({ actor, actorId: actorSession.user.id, authentication: 'Actual GoTrue password grant',
      method: 'POST', path: `/rest/v1/rpc/${rpcName}`, request: requestBody, status: observed.status, response: await observed.json() });
  }
  await writeFile(join(output, 'transport-observations.json'), JSON.stringify({
    source: report.source, services: report.services, observedAt: new Date().toISOString(), observations: report.transport,
  }, null, 2) + '\n');
  const fixturePath = join(cluster.directory, 'product-fixture.json');
  await writeFile(fixturePath, JSON.stringify({ ...fixture, apiUrl: services.gatewayUrl, anonKey: services.anonKey }), { mode: 0o600 });
  const child = spawn(process.execPath, [join(here, 'node_modules/@playwright/test/cli.js'), 'test', '--config', join(here, 'product-playwright.config.ts')], {
    cwd: repository, stdio: 'inherit', env: {
      ...process.env, VITE_SUPABASE_URL: services.gatewayUrl, VITE_SUPABASE_ANON_KEY: services.anonKey,
      ATLAS_ISOLATED_FIXTURE: fixturePath, ATLAS_ISOLATED_FRONTEND_URL: `http://127.0.0.1:${frontendPort}`,
      ATLAS_ISOLATED_EVIDENCE: join(output, 'browser'),
    },
  });
  browserProcess = child;
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  report.playwrightExitCode = code;
  report.status = code === 0 ? 'passed' : 'failed';
  const browser = JSON.parse(await readFile(join(output, 'browser/playwright-report.json'), 'utf8'));
  report.browser = { expected: browser.stats.expected, unexpected: browser.stats.unexpected, skipped: browser.stats.skipped, flaky: browser.stats.flaky };
  if (code !== 0 || browser.stats.expected < 3 || browser.stats.skipped || browser.stats.flaky) {
    report.status = 'failed'; process.exitCode = 1;
  }
} catch (error) {
  report.status = 'failed'; report.error = error.message; process.exitCode = 1;
  console.error(error.message);
} finally {
  if (client) await client.end().catch(() => {});
  if (services) await services.close();
  if (cluster) await cluster.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Actual product evidence: ${join(output, 'report.json')}`);
}

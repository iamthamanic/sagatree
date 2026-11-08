#!/usr/bin/env node
/**
 * live-session-media-plane-check — #363 media plane contract + authz + degrade.
 * Location: scripts/live-session-media-plane-check.mjs
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('..', import.meta.url));
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');
let failures = 0;
let group = '';

function section(name) {
  group = name;
}

function check(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error(`FAIL [${group}]: ${msg}`);
  }
}

function mustInclude(file, needles) {
  const text = readFileSync(join(root, file), 'utf8');
  for (const n of needles) {
    if (!text.includes(n)) {
      failures += 1;
      console.error(`FAIL [${group}]: missing ${JSON.stringify(n)} in ${file}`);
    }
  }
}

function mustNotInclude(file, needles) {
  const text = readFileSync(join(root, file), 'utf8');
  for (const n of needles) {
    if (text.includes(n)) {
      failures += 1;
      console.error(`FAIL [${group}]: forbidden ${JSON.stringify(n)} in ${file}`);
    }
  }
}

section('1 · structure');
for (const f of [
  'src/domains/session/media/media-plane-contract.ts',
  'src/infrastructure/session/media/session-media-plane.ts',
  'src/infrastructure/session/media/memory-media-plane-adapter.ts',
  'src/infrastructure/session/media/livekit-media-plane-adapter.ts',
  'src/infrastructure/session/media/media-token-client.ts',
  'src/app/session/media/useSessionMediaPlane.ts',
  'supabase/functions/session-media-token/index.ts',
  'supabase/functions/_shared/session-media-token.ts',
]) {
  check(existsSync(join(root, f)), f);
}

section('2 · layer purity');
mustNotInclude('src/domains/session/media/media-plane-contract.ts', [
  'livekit-client',
  'supabase',
]);
mustNotInclude('src/app/session/media/useSessionMediaPlane.ts', ['livekit-client']);
mustInclude('src/infrastructure/session/media/livekit-media-plane-adapter.ts', [
  'LiveKitMediaPlaneAdapter',
]);
mustInclude('supabase/functions/session-media-token/index.ts', [
  'corsHeaders',
  'LIVEKIT_API_SECRET',
  'degraded',
]);

section('3 · domain + access runtime');
const outdir = join(root, 'node_modules', '.cache', 'live-session-media-plane-check');
mkdirSync(outdir, { recursive: true });

execFileSync(
  esbuild,
  [
    join(root, 'src/domains/session/media/media-plane-contract.ts'),
    '--bundle',
    '--format=esm',
    `--outfile=${join(outdir, 'domain.mjs')}`,
  ],
  { stdio: 'inherit' },
);
execFileSync(
  esbuild,
  [
    join(root, 'src/domains/session/contracts/live-session-access.ts'),
    '--bundle',
    '--format=esm',
    `--outfile=${join(outdir, 'access.mjs')}`,
  ],
  { stdio: 'inherit' },
);

const domain = await import(pathToFileURL(join(outdir, 'domain.mjs')).href);
const access = await import(pathToFileURL(join(outdir, 'access.mjs')).href);

const player = access.validateLiveSessionAccess({
  role: 'player',
  capabilities: [],
  characterId: 'c1',
});
const viewer = access.validateLiveSessionAccess({ role: 'viewer', capabilities: [] });
check(player.ok && viewer.ok, 'access ok');
check(domain.deriveMediaRoomId('abc') === 'sagatree-session-abc', 'room id');
check(domain.canPublishTrack(player.access, 'camera') === true, 'player publish');
check(domain.canPublishTrack(viewer.access, 'camera') === false, 'viewer no publish');
check(domain.resolveMediaGrant(viewer.access).receiveOnly === true, 'receiveOnly');
check(domain.resolveMediaGrant(viewer.access).canSubscribe === true, 'viewer subscribe');
check(
  domain.filterPublishIntentsForAccess(viewer.access, [
    { kind: 'camera', enabled: true },
  ]).length === 0,
  'downgrade strips',
);

section('4 · memory adapter');
execFileSync(
  esbuild,
  [
    join(root, 'src/infrastructure/session/media/memory-media-plane-adapter.ts'),
    '--bundle',
    '--format=esm',
    `--outfile=${join(outdir, 'memory.mjs')}`,
  ],
  { stdio: 'inherit' },
);
const memMod = await import(pathToFileURL(join(outdir, 'memory.mjs')).href);
const mem = new memMod.MemoryMediaPlaneAdapter();
await mem.connect({
  sessionId: 's1',
  access: player.access,
  identity: 'u1',
  token: 't',
  url: 'wss://x',
});
await mem.publish([{ kind: 'camera', enabled: true }]);
check(mem.getPresence().participants[0].published.includes('camera'), 'publish');
await mem.simulateReconnect();
check(mem.getHealth() === 'ready', 'reconnect');

section('5 · role downgrade + degrade path (memory + domain)');
// Simulate facade downgrade without bundling supabase-backed token client.
await mem.connect({
  sessionId: 's2',
  access: player.access,
  identity: 'u2',
  token: 't',
  url: 'wss://x',
});
await mem.publish([
  { kind: 'camera', enabled: true },
  { kind: 'microphone', enabled: true },
]);
const before = mem.getPresence().participants[0].published.slice();
check(before.includes('camera') && before.includes('microphone'), 'pre-downgrade pubs');
const forbidden = before.filter((k) => !domain.canPublishTrack(viewer.access, k));
await mem.unpublish(forbidden);
check(mem.getPresence().participants[0].published.length === 0, 'post-downgrade clear');

mustInclude('src/infrastructure/session/media/session-media-plane.ts', [
  'degradedMediaStatus',
  'media_service_unavailable',
  'applyAccessDowngrade',
  'filterPublishIntentsForAccess',
]);
mustInclude('src/infrastructure/session/media/media-token-client.ts', [
  'fetchHostSessionMediaToken',
  'degraded',
  '/api/v1/sessions/:id/media-token',
]);

section('6 · edge helpers');
mustInclude('supabase/functions/_shared/session-media-token.ts', [
  'mintLiveKitAccessToken',
  'resolveEdgeMediaGrant',
]);

if (failures > 0) {
  console.error(`\nlive-session-media-plane-check: ${failures} Fehler`);
  process.exit(1);
}
console.log('live-session-media-plane-check: OK (#363)');

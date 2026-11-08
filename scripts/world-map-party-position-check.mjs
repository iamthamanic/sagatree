#!/usr/bin/env node
/**
 * world-map-party-position-check — #581 party marker on map + hub wiring.
 * Location: scripts/world-map-party-position-check.mjs
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function fail(message) {
  console.error(`World map party position check failed: ${message}`);
  process.exit(1);
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) fail(`missing ${label}`);
}

const migration = 'archive/supabase-legacy/supabase/migrations/069_party_location_overview.sql';
if (!existsSync(join(root, migration))) fail(`missing ${migration}`);
const mig = read(migration);
requireMatch(mig, /partyLocationRef/i, 'partyLocationRef in overview');
requireMatch(mig, /worldProfileId/i, 'worldProfileId in overview');
requireMatch(mig, /get_saga_overview/i, 'get_saga_overview');

const domain = read('src/domains/session/contracts/party-location.ts');
requireMatch(domain, /export function formatPartyMapLocation/i, 'formatPartyMapLocation');
requireMatch(domain, /export function parsePartyLocation/i, 'parsePartyLocation');
requireMatch(domain, /map:/i, 'map: encoding');

const overview = read('src/domains/project/contracts/saga-overview.ts');
requireMatch(overview, /partyLocationRef/i, 'overview partyLocationRef');
requireMatch(overview, /worldProfileId/i, 'overview worldProfileId');

const panel = read('src/app/project/overview/SagaWorldStatePanel.tsx');
requireMatch(panel, /Ihr seid hier/i, 'hub Ihr seid hier');
requireMatch(panel, /data-saga-overview-party-location/i, 'hub party marker');
requireMatch(panel, /WorldMapPlayerView/i, 'hub map view');

const player = read('src/app/world/map/WorldMapPlayerView.tsx');
requireMatch(player, /canMoveParty/i, 'canMoveParty');
requireMatch(player, /partyLocationRef/i, 'partyLocationRef prop');
requireMatch(player, /tool=\{canMoveParty/i, 'party tool gate');

const canvas = read('src/app/world/map/WorldMapCanvas.tsx');
requireMatch(canvas, /PARTY_MARKER_COLOR/i, 'party marker color');
requireMatch(canvas, /onPartyPlace/i, 'onPartyPlace');
requireMatch(canvas, /tool === 'party'/i, 'party tool');

const gm = read('src/app/session/SagaPartyLocationGmPanel.tsx');
requireMatch(gm, /set_party_location/i, 'set_party_location op');
requireMatch(gm, /data-saga-party-location-gm/i, 'gm panel marker');
requireMatch(gm, /min-h-11/i, 'AU hit targets');

const live = read('src/app/session/GamemasterLiveScreen.tsx');
requireMatch(live, /SagaPartyLocationGmPanel/i, 'live GM party panel');
requireMatch(live, /canMoveParty/i, 'live map move');

const between = read('src/app/session/SagaBetweenSessionsSection.tsx');
requireMatch(between, /SagaPartyLocationGmPanel/i, 'between-sessions party panel');

requireMatch(read('scripts/apply-migrations.sh'), /069_party_location_overview\.sql/, 'apply-migrations');
requireMatch(read('scripts/test-gate.mjs'), /world-map-party-position-check\.mjs/, 'test-gate');

const ops = read('archive/supabase-legacy/supabase/migrations/065_saga_simulation_ops.sql');
requireMatch(ops, /set_party_location/i, 'op exists from #577');

const touched = [
  domain,
  overview,
  panel,
  player,
  canvas,
  gm,
  live,
  between,
  read('src/app/project/SagaResourceScreen.tsx'),
];
for (const content of touched) {
  if (/\bas any\b|eslint-disable|@ts-ignore|@ts-expect-error/.test(content)) {
    fail('type escape hatch');
  }
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/world-map-party-position-check');
mkdirSync(cacheDir, { recursive: true });
const out = join(cacheDir, 'party-location.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/contracts/party-location.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  logLevel: 'silent',
});
const mod = await import(pathToFileURL(out).href);
const encoded = mod.formatPartyMapLocation(3, 7);
if (encoded !== 'map:3,7') fail(`format expected map:3,7 got ${encoded}`);
const parsed = mod.parsePartyLocation(encoded);
if (!parsed || parsed.kind !== 'map' || parsed.position.x !== 3 || parsed.position.y !== 7) {
  fail('parse map coords');
}
const label = mod.parsePartyLocation('Tor von Dornhain');
if (!label || label.kind !== 'label' || label.label !== 'Tor von Dornhain') {
  fail('parse label');
}
if (mod.partyLocationDisplayLabel('map:1,2') !== 'Karte (1, 2)') {
  fail('display label map');
}

const overviewOut = join(cacheDir, 'overview.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/project/contracts/saga-overview.ts')],
  outfile: overviewOut,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  logLevel: 'silent',
});
const overviewMod = await import(pathToFileURL(overviewOut).href);
const vm = overviewMod.parseSagaOverview({
  projectId: 'p1',
  sagaPublicId: 'SA-TEST',
  title: 'T',
  blurb: '',
  status: 'active',
  selfRole: 'player',
  isGm: false,
  worldProfileId: 'wp1',
  definitionRef: null,
  sagaDefinitionId: null,
  sagaVersionId: null,
  versionLabel: null,
  newerVersionAvailable: false,
  primaryAction: { kind: 'wait', labelDe: 'Warten', sessionPublicId: null },
  episodes: [],
  ensemble: [],
  worldStateSummary: {
    clocks: [],
    consequences: [],
    openDeadlines: [],
    partyLocationRef: 'map:4,5',
    flagCount: 0,
    updatedAt: null,
  },
});
if (vm.worldProfileId !== 'wp1') fail('parse worldProfileId');
if (vm.worldStateSummary.partyLocationRef !== 'map:4,5') fail('parse partyLocationRef');

console.log('World map party position check OK');

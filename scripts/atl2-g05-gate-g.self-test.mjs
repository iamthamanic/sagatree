#!/usr/bin/env node
/**
 * ATL2-G05 Gate G — Phase G security / perf / adaptive / visual acceptance.
 * Location: scripts/atl2-g05-gate-g.self-test.mjs
 *
 * Not a product feature — evidence lock for Epic #1196 Gate G (#1233).
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const STACK = [
  {
    pr: 1279,
    issue: 1229,
    sha: '8df8589249cd73ec4abf5959669d18364ea0777a',
    title: 'ATL2-G01 GM/player scopes',
  },
  {
    pr: 1280,
    issue: 1230,
    sha: '60749aeab7811adda0918602635bedb34fc336fe',
    title: 'ATL2-G02 perf budgets',
  },
  {
    pr: 1282,
    issue: 1231,
    sha: 'bd8959322b310cd7e049eecf1e11cd0fed868dc9',
    title: 'ATL2-G03 adaptive UX',
  },
  {
    pr: 1283,
    issue: 1232,
    sha: '9009014e3881249ec295cc8dc265108f08c13d04',
    title: 'ATL2-G04 golden visual',
  },
];

function unusedPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('no port'));
        return;
      }
      const { port } = address;
      server.close((err) => (err ? reject(err) : resolve(port)));
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
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, text, json, cookie: cookieHeaderFromResponse(res) || cookie || '' };
}

const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const stackStatus = [];
for (const item of STACK) {
  let present = false;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', item.sha, 'HEAD'], {
      cwd: root,
      stdio: 'ignore',
    });
    present = true;
  } catch {
    present = false;
  }
  stackStatus.push({ ...item, present });
  assert.equal(present, true, `PR #${item.pr} squash ${item.sha} is ancestor of HEAD`);
}

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-g05.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-g05-gate-g.md'), 'utf8');
const composition = readFileSync(join(root, '.qa/runs/composition-gate-atl2-g05.md'), 'utf8');
const gateSrc = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const e2ePath = join(root, 'e2e/atl2-g05-gate-g.spec.ts');
const e2eG04 = readFileSync(join(root, 'e2e/atl2-g04-golden-visual.spec.ts'), 'utf8');

assert.ok(acceptance.includes('atl2-g05'));
assert.ok(acceptance.includes('#1233'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(acceptance.includes('AU-CONTENT-WIDTH'));
assert.ok(acceptance.includes('SC-01'));
assert.ok(design.includes('playerView'));
assert.ok(composition.includes('SKIPPED'));
assert.ok(composition.includes('atl2-g05'));
assert.ok(existsSync(e2ePath), 'missing e2e/atl2-g05-gate-g.spec.ts');
assert.ok(gateSrc.includes('atl2-g05-gate-g.self-test.mjs'), 'wired in test-gate');
assert.ok(gateSrc.includes('atl2-g01-scopes.self-test.mjs'));
assert.ok(gateSrc.includes('atl2-g02-perf-budgets.self-test.mjs'));
assert.ok(gateSrc.includes('atl2-g03-adaptive-ux.self-test.mjs'));
assert.ok(gateSrc.includes('atl2-g04-golden-visual.self-test.mjs'));
assert.ok(e2eG04.includes('toHaveScreenshot'));
assert.ok(e2eG04.includes('maxDiffPixelRatio'));

for (const slug of ['atl2-g01', 'atl2-g02', 'atl2-g03', 'atl2-g04']) {
  const doc = readFileSync(join(root, `.qa/acceptance/${slug}.md`), 'utf8');
  assert.ok(doc.includes('CLEAR') || doc.includes('[x]'), `${slug} acceptance incomplete`);
  const comp = readFileSync(join(root, `.qa/runs/composition-gate-${slug}.md`), 'utf8');
  assert.ok(comp.includes('CLEAR'), `${slug} composition not CLEAR`);
}

const party = jiti(join(root, 'src/domains/world/atlas/party-map-projection.ts'));
const perf = jiti(join(root, 'src/domains/world/atlas/atlas-perf-budgets.ts'));
const adaptive = jiti(join(root, 'src/domains/world/atlas/atlas-workstation-adaptive.ts'));
const gv = jiti(join(root, 'src/domains/world/atlas/atlas-golden-visual.ts'));
const target = jiti(join(root, 'src/domains/world/atlas/atlas-renderer-target.ts'));

assert.equal(target.ATLAS_PRODUCT_3D_TARGET, 'custom-webgl-prototype-runtime');

/* --- G01 domain party projection --- */
const layers = party.filterPartyLayers({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { id: 'ok', secret: false }, geometry: null },
    { type: 'Feature', properties: { id: 'sec', secret: true }, geometry: null },
  ],
});
assert.equal(layers.features.length, 1);
const meta = party.redactPartyGeneratorMeta({
  dungeon: { themeKey: 'ancient', seed: 99, confirmed: true, manualDirty: true },
  unifiedCanvas: {
    objects: [{ id: 'trap', secret: true }, { id: 'torch' }],
    rooms: [],
    strokes: [],
    walls: [],
    doors: [],
  },
});
assert.deepEqual(meta.dungeon, { themeKey: 'ancient' });
assert.equal(party.partyPayloadLeaksSecrets({ layers, generatorMeta: meta }), false);

const storeSrc = readFileSync(
  join(root, 'server/src/modules/world/internal/world-atlas-store.ts'),
  'utf8',
);
assert.ok(storeSrc.includes('redactPartyGeneratorMeta'));
assert.ok(storeSrc.includes('canEditWorld'));

/* --- G02 perf + teardown --- */
assert.ok(perf.ATLAS_PERF_SCENE_FIXTURES.length >= 3);
const large = perf.resolveAtlasPerfSceneFixture('large');
assert.ok(large);
let session = perf.createAtlasGpuResourceSession();
session = perf.atlasGpuAcquire(session, 24);
for (let i = 0; i < 4; i += 1) {
  session = perf.atlasGpuMapSwitch(session, 8 + i);
}
session = perf.atlasGpuReleaseAll(session);
assert.equal(perf.atlasGpuSessionWithinTeardownBudget(session), true);
session = perf.atlasGpuAcquire(session, 16);
session = perf.atlasGpuContextLost(session);
session = perf.atlasGpuContextRestored(session, 8);
session = perf.atlasGpuReleaseAll(session);
assert.equal(perf.atlasGpuSessionWithinTeardownBudget(session), true);

/* --- G03 adaptive --- */
assert.equal(adaptive.resolveAtlasAdaptiveBand(390), 'phone');
assert.equal(adaptive.resolveAtlasAdaptiveBand(800), 'tablet');
assert.equal(adaptive.resolveAtlasAdaptiveBand(1280), 'desktop');
assert.equal(adaptive.ATLAS_MIN_TOUCH_TARGET_PX, 44);
assert.ok(adaptive.atlasContentWidthUsable(390));
assert.equal(adaptive.atlasContentWidthUsable(200), false);
assert.ok(adaptive.atlasCriticalControlsForBand('phone').length > 0);
assert.ok(adaptive.ATLAS_KEYBOARD_SHORTCUTS.length > 0);
assert.equal(adaptive.resolveAtlasWorkstationSurfaceState({}), 'ready');
assert.equal(adaptive.resolveAtlasWorkstationSurfaceState({ loading: true }), 'loading');
assert.equal(adaptive.resolveAtlasWorkstationSurfaceState({ webglFallback: true }), 'webgl-fallback');
assert.match(adaptive.atlasWorkstationSurfaceLabelDe('webgl-fallback'), /WebGL/);
assert.ok(
  adaptive.atlasChromeOverflowSafe({
    contentWidthPx: 320,
    criticalControlCount: adaptive.atlasCriticalControlsForBand('phone').length,
  }),
);

/* --- G04 golden visual --- */
assert.equal(gv.ATLAS_GOLDEN_VISUAL_FIXTURES.length, 6);
assert.equal(gv.ATLAS_GOLDEN_VISUAL_TOLERANCE.ciMode, 'fingerprint-and-screenshot');
assert.equal(gv.ATLAS_GOLDEN_VISUAL_TOLERANCE.maxDiffPixelRatio, 0.08);
assert.ok(gv.atlasGoldenVisualFixturesCoverHierarchy());
const art = gv.evaluateAtlasGoldenArtDirection();
assert.equal(art.allPass, true, 'art-direction allPass');
for (const fixture of gv.ATLAS_GOLDEN_VISUAL_FIXTURES) {
  const snap = gv.buildAtlasGoldenVisualSnapshot(fixture);
  assert.ok(snap?.contentFingerprint || snap?.geometryFingerprint);
  const baseline = gv.resolveAtlasGoldenVisualBaseline(fixture.id);
  assert.ok(baseline, `baseline for ${fixture.id}`);
  const cmp = gv.snapshotMatchesGoldenBaseline(snap, baseline);
  assert.equal(cmp.ok, true, `baseline mismatch ${fixture.id}: ${JSON.stringify(cmp)}`);
}

const escapeHatches = [
  join(root, 'src/domains/world/atlas/party-map-projection.ts'),
  join(root, 'src/domains/world/atlas/atlas-perf-budgets.ts'),
  join(root, 'src/domains/world/atlas/atlas-workstation-adaptive.ts'),
  join(root, 'src/domains/world/atlas/atlas-golden-visual.ts'),
];
for (const path of escapeHatches) {
  const src = readFileSync(path, 'utf8');
  assert.ok(!src.includes(' as any'), path);
  assert.ok(!src.includes('@ts-ignore'), path);
  assert.ok(!src.includes('@ts-expect-error'), path);
}

const sollIst = [
  {
    category: 'G01–G04 stack on main',
    soll: 'squash SHAs #1279/#1280/#1282/#1283 are ancestors of HEAD',
    ist: 'pass-git',
  },
  {
    category: 'Party / secret policy (domain)',
    soll: 'party projection strips secrets; dungeon theme-only; host store wires redaction',
    ist: 'pass-domain',
  },
  {
    category: 'Perf / memory budgets (domain)',
    soll: 'fixtures + map-switch/context-loss teardown within budget (no unbounded leak)',
    ist: 'pass-domain',
  },
  {
    category: 'Adaptive UX (domain)',
    soll: 'phone/tablet/desktop bands, 44px touch, surface states, keyboard shortcuts',
    ist: 'pass-domain',
  },
  {
    category: 'Golden visual (domain + e2e contract)',
    soll: '6 fixtures match baselines; Browser E2E toHaveScreenshot @ 0.08',
    ist: 'pass-domain',
  },
  {
    category: 'Host stranger deny',
    soll: 'non-owner atlas write denied (42501/403)',
    ist: 'pending-host',
  },
  {
    category: 'Host playerView redaction',
    soll: 'crypt playerView strips secret/crypt entities after party reveal',
    ist: 'pending-host',
  },
];

const work = mkdtempSync(join(tmpdir(), 'atl2-g05-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const authIndexUrl = pathToFileURL(join(root, 'server/src/auth/index.ts')).href;
const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);
const port = await unusedPort();
const hostUrl = `http://127.0.0.1:${port}`;

let host;
const hostEvidence = {
  ownerMapCount: 0,
  worldPublicId: null,
  strangerDeny: false,
  outsiderStatus: null,
  playerViewRedaction: false,
  playerViewMapCount: 0,
};

const evidence = {
  gate: 'atl2-g05',
  issue: 1233,
  head,
  stack: stackStatus,
  host: hostEvidence,
  sollIst,
  verdict: 'OPEN',
  residuals: [],
};

try {
  host = createHost({
    SAGATREE_DATA_DIR: dataDir,
    SAGATREE_PORT: String(port),
    SAGATREE_HOST: '127.0.0.1',
    SAGATREE_ENABLE_HOST_AUTH: '1',
    SAGATREE_BETTER_AUTH_SECRET: generateAuthSecret(),
    SAGATREE_AUTH_BASE_URL: hostUrl,
    SAGATREE_AUTH_TRUSTED_ORIGINS: `${hostUrl},http://localhost:3004`,
    SAGATREE_ALLOW_DEMO_PASSWORDS: '1',
  });
  if ('error' in host) throw new Error(JSON.stringify(host));
  await host.start();

  const ownerSign = await httpJson(hostUrl, '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: hostUrl },
    body: { email: 'gm-gate-g@sagatree.test', password: '1234', name: 'gm' },
  });
  assert.ok(ownerSign.res.status < 400, `owner sign-up ${ownerSign.res.status}`);
  let ownerCookie = ownerSign.cookie;
  if (!ownerCookie) {
    const si = await httpJson(hostUrl, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: hostUrl },
      body: { email: 'gm-gate-g@sagatree.test', password: '1234' },
    });
    ownerCookie = si.cookie;
  }
  assert.ok(ownerCookie, 'owner cookie');

  const ensure = await httpJson(hostUrl, '/api/v1/projects/ensure-starter', {
    method: 'POST',
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
    body: { slug: 'dornhain.whisper' },
  });
  assert.equal(ensure.res.status, 200, `ensure-starter ${ensure.text}`);
  const sagaPublicId = ensure.json?.publicId;
  assert.ok(typeof sagaPublicId === 'string' && sagaPublicId.startsWith('SA-'), 'saga public id');

  const worlds = await httpJson(hostUrl, '/api/v1/library/worlds', {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  const dornhain = (worlds.json?.worlds ?? []).find((w) => w.title === 'Dornhain');
  assert.ok(dornhain?.id, 'Dornhain world');
  hostEvidence.worldPublicId = dornhain.publicId ?? null;

  const mapsRes = await httpJson(hostUrl, `/api/v1/worlds/${dornhain.id}/atlas/maps`, {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  assert.equal(mapsRes.res.status, 200, mapsRes.text);
  const mapRows = mapsRes.json?.maps ?? [];
  hostEvidence.ownerMapCount = mapRows.length;
  assert.ok(mapRows.length >= 6, `expected ≥6 golden maps, got ${mapRows.length}`);

  const welt = mapRows.find((m) => m.title === 'Welt');
  assert.ok(welt?.id, 'Welt map');
  const weltDetail = await httpJson(hostUrl, `/api/v1/worlds/atlas/maps/${welt.id}`, {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  assert.equal(weltDetail.res.status, 200, weltDetail.text);
  const weltVm = weltDetail.json?.map ?? weltDetail.json;
  const rev0 = weltVm?.revision ?? welt?.revision;

  const strangerSign = await httpJson(hostUrl, '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: hostUrl },
    body: { email: 'stranger-gate-g@sagatree.test', password: '1234', name: 'x' },
  });
  let strangerCookie = strangerSign.cookie;
  if (!strangerCookie) {
    const si = await httpJson(hostUrl, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: hostUrl },
      body: { email: 'stranger-gate-g@sagatree.test', password: '1234' },
    });
    strangerCookie = si.cookie;
  }
  assert.ok(strangerCookie, 'stranger cookie');

  const strangerWrite = await httpJson(hostUrl, `/api/v1/worlds/${dornhain.id}/atlas/maps`, {
    method: 'PUT',
    headers: { Origin: hostUrl },
    cookie: strangerCookie,
    body: {
      mapId: welt.id,
      parentMapId: weltVm?.parentMapId ?? null,
      kind: weltVm?.kind ?? 'world',
      title: 'Hacked',
      sortOrder: weltVm?.sortOrder ?? 0,
      bounds: weltVm?.bounds ?? { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
      layers: weltVm?.layers ?? { type: 'FeatureCollection', features: [] },
      basemapStoragePath: null,
      azgaarMapStoragePath: null,
      generatorMeta: weltVm?.generatorMeta ?? {},
      expectedRevision: rev0,
    },
  });
  assert.ok(
    strangerWrite.res.status >= 400 &&
      (strangerWrite.json?.error === '42501' ||
        String(strangerWrite.text).includes('42501') ||
        strangerWrite.res.status === 403),
    `stranger deny expected; got ${strangerWrite.res.status} ${strangerWrite.text.slice(0, 200)}`,
  );
  hostEvidence.strangerDeny = true;
  hostEvidence.outsiderStatus = strangerWrite.res.status;
  sollIst[5].ist = 'pass-host';

  const cryptSummary = mapRows.find((m) => m.title === 'Krypta unter dem Hügel');
  assert.ok(cryptSummary?.id, 'crypt map');
  const cryptGm = await httpJson(hostUrl, `/api/v1/worlds/atlas/maps/${cryptSummary.id}`, {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  assert.equal(cryptGm.res.status, 200, cryptGm.text);
  const gmMeta =
    cryptGm.json?.generatorMeta ??
    cryptGm.json?.map?.generatorMeta ??
    cryptGm.json?.generator_meta ??
    null;
  const canvas = gmMeta?.unifiedCanvas;
  assert.ok(canvas, `crypt GM canvas missing: ${cryptGm.text.slice(0, 300)}`);

  const places = await httpJson(hostUrl, `/api/v1/worlds/${dornhain.id}/places`, {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  const cryptPlace = (places.json?.places ?? []).find(
    (p) => p.seedKey === 'loc.crypt' || p.name === 'Krypta unter dem Hügel',
  );
  assert.ok(cryptPlace?.id, 'crypt place');
  const dbPath = join(dataDir, 'host.sqlite');
  const db = new DatabaseSync(dbPath);
  try {
    db.prepare(
      `INSERT INTO saga_asset_bindings
         (id, project_id, asset_kind, asset_id, reveal, label, metadata, world_place_id, updated_at)
       VALUES (?, ?, 'location', ?, 'party', 'Gate G crypt reveal', '{}', ?, ?)`,
    ).run(
      randomUUID(),
      ensure.json.id,
      cryptPlace.id,
      cryptPlace.id,
      new Date().toISOString(),
    );
  } finally {
    db.close();
  }

  const cryptPlayer = await httpJson(
    hostUrl,
    `/api/v1/worlds/atlas/maps/${cryptSummary.id}?playerView=1&sagaPublicId=${encodeURIComponent(sagaPublicId)}`,
    { headers: { Origin: hostUrl }, cookie: ownerCookie },
  );
  assert.equal(cryptPlayer.res.status, 200, cryptPlayer.text);
  const playerMeta =
    cryptPlayer.json?.generatorMeta ?? cryptPlayer.json?.map?.generatorMeta ?? null;
  const playerCanvas = playerMeta?.unifiedCanvas;
  assert.ok(playerCanvas, 'player crypt canvas');
  const leaked = [...(playerCanvas.objects ?? []), ...(playerCanvas.rooms ?? [])].filter(
    (row) =>
      row && (row.secret === true || row.id === 's.obj.crypt' || row.id === 's.crypt'),
  );
  assert.equal(leaked.length, 0, `player view leaked secrets: ${JSON.stringify(leaked)}`);
  if (playerMeta?.dungeon) {
    assert.equal(
      Object.keys(playerMeta.dungeon).every((k) => k === 'themeKey'),
      true,
      `player dungeon meta must be theme-only: ${JSON.stringify(playerMeta.dungeon)}`,
    );
  }
  hostEvidence.playerViewRedaction = true;
  hostEvidence.playerViewMapCount = 1;
  sollIst[6].ist = 'pass-host';

  evidence.verdict = 'CLEAR';
  evidence.residuals = [
    {
      severity: 'Info',
      note:
        'Full Browser E2E G04 pixel matrix + mobile device projects remain CI-enforced; Gate G locks host+domain protocol for G01–G04.',
    },
  ];
} finally {
  if (host && typeof host.stop === 'function') {
    try {
      await host.stop();
    } catch {
      /* */
    }
  }
  rmSync(work, { recursive: true, force: true });
}

const stackRows = stackStatus
  .map(
    (s) =>
      `| #${s.pr} | #${s.issue} | \`${s.sha.slice(0, 10)}\` ${s.title} | ${s.present ? 'yes' : 'NO'} |`,
  )
  .join('\n');

const sollRows = sollIst.map((r) => `| ${r.category} | ${r.soll} | **${r.ist}** |`).join('\n');

const report = `# ATL2-G05 Gate G — Phase G quality acceptance

- Issue: #1233
- HEAD: \`${head}\`
- Verdict: **${evidence.verdict}**
- Date: ${new Date().toISOString().slice(0, 10)}

## PR stack on main

| PR | Issue | Squash SHA | Present |
|----|-------|------------|---------|
${stackRows}

## Host security negatives

- Owner ensure-starter → Dornhain atlas maps: **${hostEvidence.ownerMapCount}**
- World publicId: **${hostEvidence.worldPublicId ?? 'n/a'}**
- Stranger write deny: **${hostEvidence.strangerDeny ? 'yes' : 'no'}** (status **${hostEvidence.outsiderStatus ?? 'n/a'}**)
- Player-view crypt redaction: **${hostEvidence.playerViewRedaction ? 'yes' : 'no'}**

## Soll / Ist (feature categories)

| Category | Soll | Ist |
|----------|------|-----|
${sollRows}

## Residuals (non-blocking for Gate G)

- **Info**: G04 Browser E2E pixel-diff matrix remains the shipping visual gate; Gate G stitches policy/perf/adaptive/visual contracts.

## Decision

Phase G quality foundation is **${evidence.verdict}**.
`;

const writeEvidence = process.env.ATL2_G05_WRITE_EVIDENCE === '1';
const outDir = writeEvidence ? join(root, '.qa/runs') : mkdtempSync(join(tmpdir(), 'atl2-g05-out-'));
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'atl2-g05-gate-g.md'), report);
writeFileSync(join(outDir, 'atl2-g05-gate-g.json'), `${JSON.stringify(evidence, null, 2)}\n`);

if (writeEvidence) {
  console.log(`wrote evidence to ${outDir}`);
}

const committedPath = join(root, '.qa/runs/atl2-g05-gate-g.md');
let committed;
try {
  committed = readFileSync(committedPath, 'utf8');
} catch {
  committed = null;
}
if (committed) {
  assert.match(committed, /Verdict: \*\*CLEAR\*\*/);
  assert.match(committed, /#1283/);
  assert.match(committed, /Soll \/ Ist/);
}

console.log(`atl2-g05-gate-g self-test: PASS (${evidence.verdict})`);

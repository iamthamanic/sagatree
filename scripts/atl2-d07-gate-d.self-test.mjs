#!/usr/bin/env node
/**
 * ATL2-D07 Gate D — Phase D product 3D acceptance protocol.
 * Location: scripts/atl2-d07-gate-d.self-test.mjs
 *
 * Not a product feature — evidence lock for Epic #1196 Gate D (#1218).
 * “Three.js” ticket wording = product 3D on D01-locked custom WebGL.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const EXPECTED_MAP_TITLES = [
  'Welt',
  'Kontinent Westmark',
  'Land Westmark',
  'Dornhain',
  'Taverne Zum Flüstern',
  'Krypta unter dem Hügel',
];

const STACK = [
  {
    pr: 1253,
    issue: 1212,
    sha: '1ef4ac7cc33e1960325c1e2cea5b2a4b8a8d4873',
    title: 'ATL2-D01 renderer decision',
  },
  {
    pr: 1254,
    issue: 1213,
    sha: '79737863efc82ac57e79f93fbc4c5b19a6eea753',
    title: 'ATL2-D02 canonical 3D geometry',
  },
  {
    pr: 1255,
    issue: 1214,
    sha: 'bce74cab28e775dc3f99a5c73b6aa4a8e18ac6ea',
    title: 'ATL2-D03 product camera modes',
  },
  {
    pr: 1256,
    issue: 1215,
    sha: '46288e2fafca2b88d1e0a3dd21b534ab79795209',
    title: 'ATL2-D04 heightfield terrain',
  },
  {
    pr: 1257,
    issue: 1216,
    sha: 'b6542cfa7f067e299d12558c16411b34c25d60f6',
    title: 'ATL2-D05 terrain mesh / LOD',
  },
  {
    pr: 1258,
    issue: 1217,
    sha: 'a260606ed0854c841431eae3c09dbb0ebae06694',
    title: 'ATL2-D06 diorama look',
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

const target = jiti(join(root, 'src/domains/world/atlas/atlas-renderer-target.ts'));
const cam = jiti(join(root, 'src/domains/world/atlas/atlas-product-camera.ts'));
const canvas = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));
const ops = jiti(join(root, 'src/domains/world/atlas/map-edit-ops.ts'));
const bridge = jiti(join(root, 'src/domains/world/atlas/webgl-runtime-bridge.ts'));
const hf = jiti(join(root, 'src/domains/world/atlas/atlas-heightfield.ts'));
const terrain = jiti(join(root, 'src/domains/world/atlas/atlas-terrain-mesh.ts'));
const look = jiti(join(root, 'src/domains/world/atlas/atlas-diorama-look.ts'));
const golden = jiti(join(root, 'src/domains/world/atlas/dornhain-golden-hierarchy.ts'));

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-d07-gate-d.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-d07-gate-d.md'), 'utf8');
const audit = readFileSync(join(root, '.qa/design/atl2-renderer-architecture-audit.md'), 'utf8');
const gateSrc = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const editorSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'),
  'utf8',
);
const nativeSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/AtlasNative3dEditor.tsx'),
  'utf8',
);
const runtimeSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs'),
  'utf8',
);

assert.ok(acceptance.includes('atl2-d07'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(acceptance.includes('IV-18'));
assert.ok(design.includes('custom WebGL'));
assert.ok(audit.includes('ATLAS_PRODUCT_3D_TARGET'));
assert.ok(gateSrc.includes('atl2-d07-gate-d.self-test.mjs'));
assert.equal(target.ATLAS_PRODUCT_3D_TARGET, 'custom-webgl-prototype-runtime');
assert.ok(target.isProductAtlasRendererTarget('custom-webgl-prototype-runtime'));
assert.equal(target.isProductAtlasRendererTarget('three-spatial-viewport'), false);
assert.ok(editorSrc.includes('AtlasNative3dEditor'));
assert.ok(!editorSrc.includes('AtlasSpatialViewport'));
assert.ok(nativeSrc.includes('atlas-prototype-runtime'));
assert.ok(runtimeSrc.includes('setCameraMode'));
assert.ok(runtimeSrc.includes('AtlasLite3D') || runtimeSrc.includes('preferSoftwareFallback'));

const lite = target.resolveAtlasGraphicsPreset('lite');
assert.equal(lite.preferSoftwareFallback, true);

assert.deepEqual([...cam.ATLAS_PRODUCT_CAMERA_MODES], [
  'ortho-topdown',
  'diorama-oblique',
  'perspective',
]);
let camera = cam.defaultAtlasProductCameraState({ mode: 'ortho-topdown' });
camera = cam.withAtlasProductCameraMode(camera, 'diorama-oblique');
camera = cam.withAtlasProductCameraMode(camera, 'perspective');
assert.equal(cam.cycleAtlasProductCameraMode('perspective'), 'ortho-topdown');

const dornhainCanvas = golden.buildGoldenDornhainCanvas();
assert.ok((dornhainCanvas.objects?.length ?? 0) + (dornhainCanvas.stamps?.length ?? 0) >= 1);

let doc = canvas.emptyUnifiedCanvasDoc(false);
doc = ops.applyMapEdit(doc, {
  op: 'add_object',
  object: { id: 'gate-d-haus', type: 'haus', x: 40, y: 50, size: 3, angle: 0 },
});
doc = ops.applyMapEdit(doc, {
  op: 'add_object',
  object: { id: 'gate-d-baum', type: 'baum', x: 60, y: 55, size: 2, angle: 0 },
});
doc = ops.applyMapEdit(doc, {
  op: 'paint_heightfield',
  stroke: { mode: 'raise', x: 500, z: 500, radius: 90, strength: 5 },
});
assert.ok(doc.heightfield);
assert.equal(doc.objects.length, 2);

const runtime = bridge.syncCanvasDocIntoWebglRuntime(bridge.emptyWebglRuntime(), doc);
assert.ok(Array.isArray(runtime.props) && runtime.props.length >= 2, 'props bridged from objects');
const withoutBaum = {
  ...runtime,
  props: runtime.props.filter((p) => p.id !== 'gate-d-baum'),
};
const roundTrip = bridge.syncWebglPropsIntoCanvasDoc(doc, withoutBaum);
assert.equal(roundTrip.objects.some((o) => o.id === 'gate-d-baum'), false);
assert.ok(roundTrip.objects.some((o) => o.id === 'gate-d-haus'));

doc = ops.applyMapEdit(doc, { op: 'remove_object', id: 'gate-d-baum' });
assert.equal(doc.objects.length, 1);
assert.equal(doc.objects[0].id, 'gate-d-haus');

const mesh = terrain.buildAtlasTerrainMeshPlan(doc, { span: 80 });
assert.equal(mesh.format, terrain.ATLAS_TERRAIN_MESH_FORMAT);
assert.ok(mesh.triangles.length > 0);

const diorama = look.buildAtlasDioramaLookPlan(dornhainCanvas, { graphicsPresetId: 'high' });
assert.ok(diorama.counts.houses >= 2);
assert.ok(diorama.counts.trees >= 2);
assert.ok(look.atlasDioramaLookPlanIsCanonicalOnly(diorama));

const sollIst = [
  {
    category: 'D01–D06 PR stack on main',
    soll: 'squash SHAs #1253–#1258 are ancestors of HEAD',
    ist: 'pass-git',
  },
  {
    category: 'Product 3D target lock',
    soll: 'custom-webgl-prototype-runtime; Native3d only; no SpatialViewport chrome',
    ist: 'pass-domain',
  },
  {
    category: 'Camera modes',
    soll: 'ortho / diorama / perspective cycle + clamp',
    ist: 'pass-domain',
  },
  {
    category: 'Terrain + diorama geometry',
    soll: 'heightfield mesh plan + Golden diorama batches from Saved-map canvas',
    ist: 'pass-domain',
  },
  {
    category: '2D↔3D delete parity (canonical doc)',
    soll: 'remove_object clears SoT; bridge sync does not invent ghosts',
    ist: 'pass-domain',
  },
  {
    category: 'Hierarchy travel (World→Krypta)',
    soll: 'ensure-starter yields ≥6 Golden map titles',
    ist: 'pending-host',
  },
  {
    category: 'Persist / Reload (canvas + heightfield)',
    soll: 'unifiedCanvas+heightfield survive upsert + GET',
    ist: 'pending-host',
  },
  {
    category: 'Negative policy',
    soll: 'stale rev 40001; stranger 42501',
    ist: 'pending-host',
  },
];

const work = mkdtempSync(join(tmpdir(), 'atl2-d07-'));
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
  ownerMapTitles: [],
  worldPublicId: null,
  persistReload: false,
  heightfieldReload: false,
  conflict: false,
  strangerDeny: false,
  outsiderStatus: null,
};

const evidence = {
  gate: 'atl2-d07',
  issue: 1218,
  head,
  stack: stackStatus,
  productTarget: target.ATLAS_PRODUCT_3D_TARGET,
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
    body: { email: 'gm-gate-d@sagatree.test', password: '1234', name: 'gm' },
  });
  assert.ok(ownerSign.res.status < 400, `owner sign-up ${ownerSign.res.status}`);
  let ownerCookie = ownerSign.cookie;
  if (!ownerCookie) {
    const si = await httpJson(hostUrl, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: hostUrl },
      body: { email: 'gm-gate-d@sagatree.test', password: '1234' },
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

  const worlds = await httpJson(hostUrl, '/api/v1/library/worlds', {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  const dornhain = (worlds.json?.worlds ?? []).find((w) => w.title === 'Dornhain');
  assert.ok(dornhain?.id, 'Dornhain world');
  hostEvidence.worldPublicId = dornhain.publicId ?? null;

  const maps = await httpJson(hostUrl, `/api/v1/worlds/${dornhain.id}/atlas/maps`, {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  assert.equal(maps.res.status, 200, maps.text);
  const titles = (maps.json?.maps ?? []).map((m) => m.title);
  for (const t of EXPECTED_MAP_TITLES) {
    assert.ok(titles.includes(t), `missing map title ${t}; got ${titles.join(',')}`);
  }
  hostEvidence.ownerMapCount = titles.length;
  hostEvidence.ownerMapTitles = titles;
  sollIst[5].ist = 'pass-host';

  const welt = (maps.json?.maps ?? []).find((m) => m.title === 'Welt');
  assert.ok(welt?.id, 'Welt map');
  const weltGet = await httpJson(hostUrl, `/api/v1/worlds/atlas/maps/${welt.id}`, {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  assert.equal(weltGet.res.status, 200, weltGet.text);
  const weltVm = weltGet.json?.map ?? weltGet.json;
  const rev0 = weltVm?.revision ?? welt?.revision;
  assert.equal(typeof rev0, 'number');

  const editedDoc = {
    ...doc,
    objects: [
      { id: 'gate-d-haus', type: 'haus', x: 40, y: 50, size: 3, angle: 0 },
      { id: 'gate-d-keep', type: 'turm', x: 70, y: 40, size: 4, angle: 0.2 },
    ],
  };
  const editedCanvas = canvas.serializeUnifiedCanvasDoc(editedDoc);
  assert.ok(editedCanvas.heightfield, 'serialized heightfield');

  const priorMeta = weltVm?.generatorMeta ?? weltVm?.generator_meta ?? {};
  const saveBody = {
    mapId: welt.id,
    parentMapId: weltVm?.parentMapId ?? welt.parentMapId ?? null,
    kind: weltVm?.kind ?? welt.kind ?? 'world',
    title: 'Welt',
    sortOrder: weltVm?.sortOrder ?? welt.sortOrder ?? 0,
    bounds: weltVm?.bounds ?? { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    layers: weltVm?.layers ?? { type: 'FeatureCollection', features: [] },
    basemapStoragePath: weltVm?.basemapStoragePath ?? null,
    azgaarMapStoragePath: weltVm?.azgaarMapStoragePath ?? null,
    generatorMeta: {
      ...priorMeta,
      engine: 'unified_canvas',
      unifiedCanvas: editedCanvas,
    },
    expectedRevision: rev0,
  };

  const saved = await httpJson(hostUrl, `/api/v1/worlds/${dornhain.id}/atlas/maps`, {
    method: 'PUT',
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
    body: saveBody,
  });
  assert.ok(saved.res.status < 400, `owner save ${saved.res.status} ${saved.text.slice(0, 300)}`);
  const savedRev = saved.json?.revision ?? saved.json?.map?.revision;
  assert.equal(typeof savedRev, 'number');
  assert.ok(savedRev > rev0, 'revision advanced');

  const reload = await httpJson(hostUrl, `/api/v1/worlds/atlas/maps/${welt.id}`, {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  assert.equal(reload.res.status, 200, reload.text);
  const reloadMeta =
    reload.json?.generatorMeta ??
    reload.json?.map?.generatorMeta ??
    reload.json?.generator_meta ??
    null;
  const reloadCanvas = reloadMeta?.unifiedCanvas;
  assert.ok(reloadCanvas, 'reloaded canvas');
  assert.equal(reloadCanvas.objects?.length, 2);
  assert.ok(reloadCanvas.heightfield, 'reloaded heightfield');
  assert.equal(typeof reloadCanvas.heightfield.cols, 'number');
  hostEvidence.persistReload = true;
  hostEvidence.heightfieldReload = true;
  sollIst[6].ist = 'pass-host';

  const conflict = await httpJson(hostUrl, `/api/v1/worlds/${dornhain.id}/atlas/maps`, {
    method: 'PUT',
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
    body: { ...saveBody, title: 'Welt-Tab-B', expectedRevision: rev0 },
  });
  assert.ok(
    conflict.res.status >= 400 &&
      (conflict.json?.error === '40001' || String(conflict.text).includes('40001')),
    `stale rev expected 40001 got ${conflict.res.status} ${conflict.text.slice(0, 200)}`,
  );
  hostEvidence.conflict = true;

  const strangerSign = await httpJson(hostUrl, '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: hostUrl },
    body: { email: 'stranger-gate-d@sagatree.test', password: '1234', name: 'x' },
  });
  let strangerCookie = strangerSign.cookie;
  if (!strangerCookie) {
    const si = await httpJson(hostUrl, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: hostUrl },
      body: { email: 'stranger-gate-d@sagatree.test', password: '1234' },
    });
    strangerCookie = si.cookie;
  }
  assert.ok(strangerCookie, 'stranger cookie');

  const strangerWrite = await httpJson(hostUrl, `/api/v1/worlds/${dornhain.id}/atlas/maps`, {
    method: 'PUT',
    headers: { Origin: hostUrl },
    cookie: strangerCookie,
    body: { ...saveBody, expectedRevision: savedRev, title: 'Hacked' },
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
  sollIst[7].ist = 'pass-host';

  evidence.verdict = 'CLEAR';
  evidence.residuals = [
    {
      severity: 'Low',
      note:
        'Interactive GPU FPS soak on device matrix deferred — structural Lite3D + presets locked in D01; product soak continues in ops.',
    },
  ];
} finally {
  if (host && typeof host.stop === 'function') await host.stop();
  rmSync(work, { recursive: true, force: true });
}

const stackRows = stackStatus
  .map(
    (s) =>
      `| #${s.pr} | #${s.issue} | \`${s.sha.slice(0, 10)}\` ${s.title} | ${s.present ? 'yes' : 'NO'} |`,
  )
  .join('\n');

const sollRows = sollIst
  .map((r) => `| ${r.category} | ${r.soll} | **${r.ist}** |`)
  .join('\n');

const report = `# ATL2-D07 Gate D — Phase D product 3D acceptance

- Issue: #1218
- HEAD: \`${head}\`
- Verdict: **${evidence.verdict}**
- Date: ${new Date().toISOString().slice(0, 10)}
- Product 3D target: \`${target.ATLAS_PRODUCT_3D_TARGET}\` (ticket “Three.js” = product 3D)

## PR stack on main

| PR | Issue | Squash SHA | Present |
|----|-------|------------|---------|
${stackRows}

## Hierarchy travel (host)

- Owner ensure-starter → Dornhain atlas maps: **${hostEvidence.ownerMapCount}**
- Titles World→…→Krypta: yes
- World publicId: **${hostEvidence.worldPublicId ?? 'n/a'}**

## Soll / Ist (feature categories)

| Category | Soll | Ist |
|----------|------|-----|
${sollRows}

## Host CAS / ownership

- Persist + reload canvas objects: **${hostEvidence.persistReload ? 'yes' : 'no'}**
- Heightfield reload: **${hostEvidence.heightfieldReload ? 'yes' : 'no'}**
- Stale tab revision → 40001: **${hostEvidence.conflict ? 'yes' : 'no'}**
- Stranger write deny: **${hostEvidence.strangerDeny ? 'yes' : 'no'}**
- Outsider atlas write status: **${hostEvidence.outsiderStatus ?? 'n/a'}**

## Residuals (non-blocking for Gate D)

- **Low**: Interactive FPS/draw-call soak on device matrix — Structural Lite3D + preset contracts locked; device soak deferred to ops.

## Decision

Phase D product 3D foundation is **${evidence.verdict}**. Phase E may open after merge.
`;

const writeEvidence = process.env.ATL2_D07_WRITE_EVIDENCE === '1';
const outDir = writeEvidence ? join(root, '.qa/runs') : mkdtempSync(join(tmpdir(), 'atl2-d07-out-'));
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'atl2-d07-gate-d.md'), report);
writeFileSync(join(outDir, 'atl2-d07-gate-d.json'), `${JSON.stringify(evidence, null, 2)}\n`);

if (writeEvidence) {
  console.log(`wrote evidence to ${outDir}`);
}

const committedPath = join(root, '.qa/runs/atl2-d07-gate-d.md');
let committed;
try {
  committed = readFileSync(committedPath, 'utf8');
} catch {
  committed = null;
}
if (committed) {
  assert.match(committed, /Verdict: \*\*CLEAR\*\*/);
  assert.match(committed, /#1253/);
  assert.match(committed, /#1258/);
  assert.match(committed, /custom-webgl-prototype-runtime/);
} else {
  assert.equal(writeEvidence, true, 'first run must set ATL2_D07_WRITE_EVIDENCE=1 to seed .qa/runs');
}

assert.equal(evidence.verdict, 'CLEAR');
console.log(`atl2-d07-gate-d self-test: PASS (${evidence.verdict})`);
console.log(`report: ${join(outDir, 'atl2-d07-gate-d.md')}${writeEvidence ? '' : ' (transient)'}`);

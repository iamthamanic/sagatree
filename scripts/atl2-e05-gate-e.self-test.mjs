#!/usr/bin/env node
/**
 * ATL2-E05 Gate E — Phase E hierarchy travel / anchors / zoom / LOD acceptance.
 * Location: scripts/atl2-e05-gate-e.self-test.mjs
 *
 * Not a product feature — evidence lock for Epic #1196 Gate E (#1223).
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

/** Room-level titles persisted through the host (not seed-only). */
const ROOM_MAP_TITLES = ['Schankraum', 'Gruftkammer'];

const STACK = [
  {
    pr: 1259,
    issue: 1218,
    sha: '0f5875fe7da45f06c6d013ab71d90b68e33d4782',
    title: 'ATL2-D07 Gate D',
  },
  {
    pr: 1261,
    issue: 1219,
    sha: '46885289400b6a091f1d6b6b39e7fc9ebdef8ddb',
    title: 'ATL2-E01 primary maps',
  },
  {
    pr: 1264,
    issue: 1220,
    sha: '4bfbac4fa5a66b1bc1589d90f459cfae2aa4eede',
    title: 'ATL2-E02 ParentSpatialAnchor',
  },
  {
    pr: 1272,
    issue: 1221,
    sha: '95d0d8d48a733bba3113991f92e62330e0826f8d',
    title: 'ATL2-E03 hierarchy nav',
  },
  {
    pr: 1275,
    issue: 1222,
    sha: '1d4538c67ecb69c47f3f543039b7ca7432fdfb04',
    title: 'ATL2-E04 hierarchy LOD',
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

const hierarchy = jiti(join(root, 'src/domains/world/hierarchy/primary-map-links.ts'));
const nav = jiti(join(root, 'src/domains/world/atlas/atlas-hierarchy-nav.ts'));
const lod = jiti(join(root, 'src/domains/world/atlas/atlas-hierarchy-lod.ts'));
const mf = jiti(join(root, 'src/domains/world/atlas/map-frame.ts'));
const golden = jiti(join(root, 'src/domains/world/atlas/dornhain-golden-hierarchy.ts'));

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-e05.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-e05-gate-e.md'), 'utf8');
const gateSrc = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const workbench = readFileSync(join(root, 'src/app/world/atlas/WorldAtlasWorkbench.tsx'), 'utf8');

assert.ok(acceptance.includes('atl2-e05'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(acceptance.includes('AU-CONTENT-WIDTH'));
assert.ok(design.includes('ParentSpatialAnchor'));
assert.ok(gateSrc.includes('atl2-e05-gate-e.self-test.mjs'), 'wired in test-gate');
assert.equal(hierarchy.ATLAS_HIERARCHY_LEVELS.length, 6);
assert.ok(workbench.includes('prefetchChildMap') || workbench.includes('openMapWithHierarchy'));

/** Synthetic six-level chain with both room branches (ticket journey names). */
const maps = [
  { id: 'm-world', title: 'Donalu', parentMapId: null },
  { id: 'm-westmark', title: 'Kontinent Westmark', parentMapId: 'm-world' },
  { id: 'm-nordreich', title: 'Nordreich', parentMapId: 'm-westmark' },
  { id: 'm-dornhain', title: 'Dornhain', parentMapId: 'm-nordreich' },
  { id: 'm-tavern', title: 'Taverne Zum Flüstern', parentMapId: 'm-dornhain' },
  { id: 'm-schank', title: 'Schankraum', parentMapId: 'm-tavern' },
  { id: 'm-crypt', title: 'Krypta unter dem Hügel', parentMapId: 'm-dornhain' },
  { id: 'm-gruft', title: 'Gruftkammer', parentMapId: 'm-crypt' },
];

const crumbSchank = nav.buildMapBreadcrumb(maps, 'm-schank');
assert.deepEqual(
  crumbSchank.map((c) => c.id),
  ['m-world', 'm-westmark', 'm-nordreich', 'm-dornhain', 'm-tavern', 'm-schank'],
);
const crumbGruft = nav.buildMapBreadcrumb(maps, 'm-gruft');
assert.deepEqual(
  crumbGruft.map((c) => c.id),
  ['m-world', 'm-westmark', 'm-nordreich', 'm-dornhain', 'm-crypt', 'm-gruft'],
);

const camWorld = nav.defaultAtlasNavCameraView({
  centerX: 100,
  centerY: 200,
  span: 400,
  mode: 'ortho-topdown',
});
let navState = nav.createAtlasHierarchyNavState('m-dornhain', camWorld);
const locatedFrame = {
  status: 'ready',
  parentAnchor: {
    parentMapId: 'm-dornhain',
    centerX: 328,
    centerY: 528,
    extentX: 24,
    extentY: 24,
    rotationRad: 0,
    metersPerUnit: null,
  },
};
const enter = nav.enterChildMap({
  state: navState,
  childMapId: 'm-tavern',
  parentCamera: camWorld,
  childFrame: locatedFrame,
  childParentMapId: 'm-dornhain',
});
assert.equal(enter.ok, true);
navState = enter.state;

const unlocated = nav.enterChildMap({
  state: nav.createAtlasHierarchyNavState('m-dornhain', camWorld),
  childMapId: 'm-tavern',
  parentCamera: camWorld,
  childFrame: { status: 'unlocated', parentAnchor: null },
  childParentMapId: 'm-dornhain',
});
assert.equal(unlocated.ok, false);

const back = nav.navigateBack({
  state: navState,
  maps,
  currentCamera: camWorld,
});
assert.equal(back.ok, true);
assert.equal(back.state.activeMapId, 'm-dornhain');

const band = lod.lodBandFromBreadcrumbDepth(crumbSchank.length - 1);
assert.ok(lod.ATLAS_HIERARCHY_LOD_BANDS.includes(band));
let session = lod.createAtlasMapLoadSession('m-dornhain');
session = lod.beginAtlasMapLoad(session, 'm-tavern', 'loading');
const gen = session.generation;
session = lod.completeAtlasMapLoad(session, gen, 'm-tavern');
assert.equal(session.phase, 'transitioning');
session = lod.finishAtlasMapTransition(session, gen);
assert.equal(session.phase, 'ready');
session = lod.beginAtlasMapLoad(session, 'm-missing', 'loading');
const failGen = session.generation;
session = lod.failAtlasMapLoad(session, failGen, lod.LOD_LOAD_FAILED_DE);
assert.equal(lod.atlasLodFallbackActiveMapId(session), 'm-tavern');

const prefetchSkip = lod.decidePrefetchChildMap({
  childMapId: 'x',
  childFrame: null,
  cache: {},
  contentFingerprint: 'fp',
  cacheEpoch: 0,
});
assert.equal(prefetchSkip.ok, false);

const anchor = mf.assertParentSpatialAnchor({
  parentMapId: 'm-dornhain',
  centerX: 328,
  centerY: 528,
  extentX: 24,
  extentY: 24,
  rotationRad: 0,
  metersPerUnit: null,
});
assert.equal(anchor.ok, true);
const focus = nav.focusRectFromParentAnchor(anchor.anchor);
assert.ok(focus.width > 0 && focus.height > 0);

assert.ok(golden.DORNHAIN_GOLDEN_MAPS.length >= 5);
assert.ok(golden.isDornhainGoldenMapSeed(golden.DORNHAIN_WORLD_MAP_SEED));

const sollIst = [
  {
    category: 'Gate D + E01–E04 stack on main',
    soll: 'squash SHAs #1259/#1261/#1264/#1272/#1275 are ancestors of HEAD',
    ist: 'pass-git',
  },
  {
    category: 'Six hierarchy levels (domain)',
    soll: 'ATLAS_HIERARCHY_LEVELS length 6; both room-branch breadcrumbs',
    ist: 'pass-domain',
  },
  {
    category: 'Anchors + locate (domain)',
    soll: 'ParentSpatialAnchor + enterChild requires located; unlocated fails closed',
    ist: 'pass-domain',
  },
  {
    category: 'LOD / lazy load (domain)',
    soll: 'generation load → transition → ready; failure rolls back to prior ready',
    ist: 'pass-domain',
  },
  {
    category: 'Golden host maps',
    soll: 'ensure-starter yields ≥6 Golden titles World→…→Tavern/Crypt; rooms persisted via host',
    ist: 'pending-host',
  },
  {
    category: 'Located child anchors (host)',
    soll: 'every non-root map (Golden + rooms) has parent_map_id + ready ParentSpatialAnchor',
    ist: 'pending-host',
  },
  {
    category: 'Host room chains',
    soll: 'Schankraum + Gruftkammer host breadcrumbs cover six-level Building/Room branches',
    ist: 'pending-host',
  },
  {
    category: 'Negative policy',
    soll: 'stranger atlas write denied',
    ist: 'pending-host',
  },
];

const work = mkdtempSync(join(tmpdir(), 'atl2-e05-'));
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
  locatedChildren: 0,
  nonRootCount: 0,
  roomTitles: [],
  roomChains: [],
  strangerDeny: false,
  outsiderStatus: null,
};

/**
 * @param {object} args
 * @param {string} args.hostUrl
 * @param {string} args.cookie
 * @param {string} args.worldId
 * @param {string} args.parentMapId
 * @param {string} args.title
 * @param {{ centerX: number, centerY: number, extentX: number, extentY: number }} args.anchor
 */
async function createLocatedRoomMap({ hostUrl, cookie, worldId, parentMapId, title, anchor }) {
  const frame = {
    status: 'ready',
    parentAnchor: {
      parentMapId,
      centerX: anchor.centerX,
      centerY: anchor.centerY,
      extentX: anchor.extentX,
      extentY: anchor.extentY,
      rotationRad: 0,
      metersPerUnit: null,
    },
  };
  const generatorMeta = mf.mergeMapFrameIntoGeneratorMeta(
    {
      engine: 'unified_canvas',
      seed: `gate-e.room.${title}`,
      golden: false,
      scale: 'scene',
      gateE: true,
    },
    frame,
  );
  const created = await httpJson(hostUrl, `/api/v1/worlds/${worldId}/atlas/maps`, {
    method: 'PUT',
    headers: { Origin: hostUrl },
    cookie,
    body: {
      // omit mapId → host allocates a new atlas map row
      parentMapId,
      kind: 'scene',
      title,
      sortOrder: 100,
      bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
      layers: { type: 'FeatureCollection', features: [] },
      basemapStoragePath: null,
      azgaarMapStoragePath: null,
      generatorMeta,
    },
  });
  assert.ok(
    created.res.status < 400,
    `create room ${title}: ${created.res.status} ${created.text.slice(0, 300)}`,
  );
  const vm = created.json?.map ?? created.json;
  assert.ok(vm?.id, `room ${title} missing id`);
  return vm;
}

/**
 * @param {Array<{ id: string, title: string, parentMapId?: string|null, parent_map_id?: string|null }>} rows
 * @param {string} leafId
 */
function hostBreadcrumbTitles(rows, leafId) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const titles = [];
  let cur = byId.get(leafId) ?? null;
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    titles.unshift(cur.title);
    const parentId = cur.parentMapId ?? cur.parent_map_id ?? null;
    cur = parentId ? byId.get(parentId) ?? null : null;
  }
  return titles;
}

const evidence = {
  gate: 'atl2-e05',
  issue: 1223,
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
    body: { email: 'gm-gate-e@sagatree.test', password: '1234', name: 'gm' },
  });
  assert.ok(ownerSign.res.status < 400, `owner sign-up ${ownerSign.res.status}`);
  let ownerCookie = ownerSign.cookie;
  if (!ownerCookie) {
    const si = await httpJson(hostUrl, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: hostUrl },
      body: { email: 'gm-gate-e@sagatree.test', password: '1234' },
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

  const mapsRes = await httpJson(hostUrl, `/api/v1/worlds/${dornhain.id}/atlas/maps`, {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  assert.equal(mapsRes.res.status, 200, mapsRes.text);
  const mapRows = mapsRes.json?.maps ?? [];
  const titles = mapRows.map((m) => m.title);
  for (const t of EXPECTED_MAP_TITLES) {
    assert.ok(titles.includes(t), `missing map title ${t}; got ${titles.join(',')}`);
  }
  hostEvidence.ownerMapCount = titles.length;
  hostEvidence.ownerMapTitles = titles;

  const tavern = mapRows.find((m) => m.title === 'Taverne Zum Flüstern');
  const crypt = mapRows.find((m) => m.title === 'Krypta unter dem Hügel');
  assert.ok(tavern?.id, 'Taverne map');
  assert.ok(crypt?.id, 'Krypta map');

  const schank = await createLocatedRoomMap({
    hostUrl,
    cookie: ownerCookie,
    worldId: dornhain.id,
    parentMapId: tavern.id,
    title: 'Schankraum',
    anchor: { centerX: 420, centerY: 380, extentX: 48, extentY: 40 },
  });
  const gruft = await createLocatedRoomMap({
    hostUrl,
    cookie: ownerCookie,
    worldId: dornhain.id,
    parentMapId: crypt.id,
    title: 'Gruftkammer',
    anchor: { centerX: 380, centerY: 410, extentX: 44, extentY: 44 },
  });

  const mapsAfterRooms = await httpJson(hostUrl, `/api/v1/worlds/${dornhain.id}/atlas/maps`, {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  assert.equal(mapsAfterRooms.res.status, 200, mapsAfterRooms.text);
  const allRows = mapsAfterRooms.json?.maps ?? [];
  const allTitles = allRows.map((m) => m.title);
  for (const t of [...EXPECTED_MAP_TITLES, ...ROOM_MAP_TITLES]) {
    assert.ok(allTitles.includes(t), `missing map title ${t}; got ${allTitles.join(',')}`);
  }
  hostEvidence.ownerMapCount = allTitles.length;
  hostEvidence.ownerMapTitles = allTitles;
  hostEvidence.roomTitles = ROOM_MAP_TITLES.filter((t) => allTitles.includes(t));
  sollIst[4].ist = 'pass-host';

  /** Enrich list rows with parent ids from detail when list omits them. */
  const detailById = new Map();
  let located = 0;
  let nonRoot = 0;
  for (const row of allRows) {
    const detail = await httpJson(hostUrl, `/api/v1/worlds/atlas/maps/${row.id}`, {
      headers: { Origin: hostUrl },
      cookie: ownerCookie,
    });
    assert.equal(detail.res.status, 200, detail.text);
    const vm = detail.json?.map ?? detail.json;
    detailById.set(row.id, vm);
    const parentId = vm?.parentMapId ?? vm?.parent_map_id ?? null;
    const meta = vm?.generatorMeta ?? vm?.generator_meta ?? {};
    if (!parentId) {
      assert.equal(row.title, 'Welt', `root map must be Welt, got ${row.title}`);
      continue;
    }
    nonRoot += 1;
    const frame = mf.extractMapFrameFromGeneratorMeta(meta ?? {});
    const parsed = frame?.parentAnchor ? mf.parseParentSpatialAnchor(frame.parentAnchor) : null;
    assert.equal(
      frame?.status,
      'ready',
      `non-root ${row.title} mapFrame.status=${frame?.status ?? 'missing'}`,
    );
    assert.ok(parsed, `non-root ${row.title} missing ParentSpatialAnchor`);
    assert.equal(
      parsed.parentMapId,
      parentId,
      `anchor.parentMapId mismatch for ${row.title}`,
    );
    located += 1;
  }
  assert.equal(
    located,
    nonRoot,
    `every non-root map must be located; located=${located} nonRoot=${nonRoot}`,
  );
  assert.ok(nonRoot >= 7, `expected ≥7 non-root (5 Golden + 2 rooms), got ${nonRoot}`);
  hostEvidence.locatedChildren = located;
  hostEvidence.nonRootCount = nonRoot;
  sollIst[5].ist = 'pass-host';

  const chainRows = allRows.map((r) => {
    const vm = detailById.get(r.id);
    return {
      id: r.id,
      title: r.title,
      parentMapId: vm?.parentMapId ?? vm?.parent_map_id ?? r.parentMapId ?? r.parent_map_id ?? null,
    };
  });
  const schankChain = hostBreadcrumbTitles(chainRows, schank.id);
  const gruftChain = hostBreadcrumbTitles(chainRows, gruft.id);
  assert.deepEqual(schankChain, [
    'Welt',
    'Kontinent Westmark',
    'Land Westmark',
    'Dornhain',
    'Taverne Zum Flüstern',
    'Schankraum',
  ]);
  assert.deepEqual(gruftChain, [
    'Welt',
    'Kontinent Westmark',
    'Land Westmark',
    'Dornhain',
    'Krypta unter dem Hügel',
    'Gruftkammer',
  ]);
  hostEvidence.roomChains = [schankChain.join('→'), gruftChain.join('→')];
  sollIst[6].ist = 'pass-host';

  const welt = allRows.find((m) => m.title === 'Welt');
  assert.ok(welt?.id, 'Welt map');
  const weltVm = detailById.get(welt.id);
  const rev0 = weltVm?.revision ?? welt?.revision;

  const strangerSign = await httpJson(hostUrl, '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: hostUrl },
    body: { email: 'stranger-gate-e@sagatree.test', password: '1234', name: 'x' },
  });
  let strangerCookie = strangerSign.cookie;
  if (!strangerCookie) {
    const si = await httpJson(hostUrl, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: hostUrl },
      body: { email: 'stranger-gate-e@sagatree.test', password: '1234' },
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
  sollIst[7].ist = 'pass-host';

  evidence.verdict = 'CLEAR';
  evidence.residuals = [
    {
      severity: 'Info',
      note:
        'Interactive deep-link / reload matrix in live browser continues under ops; Gate E locks host+domain protocol for E01–E04.',
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

const sollRows = sollIst.map((r) => `| ${r.category} | ${r.soll} | **${r.ist}** |`).join('\n');

const report = `# ATL2-E05 Gate E — Phase E hierarchy acceptance

- Issue: #1223
- HEAD: \`${head}\`
- Verdict: **${evidence.verdict}**
- Date: ${new Date().toISOString().slice(0, 10)}

## PR stack on main

| PR | Issue | Squash SHA | Present |
|----|-------|------------|---------|
${stackRows}

## Hierarchy travel (host)

- Owner ensure-starter → Dornhain atlas maps: **${hostEvidence.ownerMapCount}**
- Titles World→…→Tavern/Crypt + rooms: yes (${(hostEvidence.roomTitles ?? []).join(', ') || 'n/a'})
- Non-root maps: **${hostEvidence.nonRootCount}**; all located: **${hostEvidence.locatedChildren}**
- Host room chains: ${(hostEvidence.roomChains ?? []).map((c) => `\`${c}\``).join(' ; ') || 'n/a'}
- World publicId: **${hostEvidence.worldPublicId ?? 'n/a'}**

## Soll / Ist (feature categories)

| Category | Soll | Ist |
|----------|------|-----|
${sollRows}

## Host ownership

- Stranger write deny: **${hostEvidence.strangerDeny ? 'yes' : 'no'}**
- Outsider atlas write status: **${hostEvidence.outsiderStatus ?? 'n/a'}**

## Residuals (non-blocking for Gate E)

- **Info**: Full interactive deep-link / reload browser matrix — protocol locked; ops soak continues.

## Decision

Phase E hierarchy foundation is **${evidence.verdict}**.
`;

const writeEvidence = process.env.ATL2_E05_WRITE_EVIDENCE === '1';
const outDir = writeEvidence ? join(root, '.qa/runs') : mkdtempSync(join(tmpdir(), 'atl2-e05-out-'));
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'atl2-e05-gate-e.md'), report);
writeFileSync(join(outDir, 'atl2-e05-gate-e.json'), `${JSON.stringify(evidence, null, 2)}\n`);

if (writeEvidence) {
  console.log(`wrote evidence to ${outDir}`);
}

const committedPath = join(root, '.qa/runs/atl2-e05-gate-e.md');
let committed;
try {
  committed = readFileSync(committedPath, 'utf8');
} catch {
  committed = null;
}
if (committed) {
  assert.match(committed, /Verdict: \*\*CLEAR\*\*/);
  assert.match(committed, /#1275/);
  assert.match(committed, /Soll \/ Ist/);
}

console.log(`atl2-e05-gate-e self-test: PASS (${evidence.verdict})`);

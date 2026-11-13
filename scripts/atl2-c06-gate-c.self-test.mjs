#!/usr/bin/env node
/**
 * ATL2-C06 Gate C — Phase C 2D editor acceptance protocol.
 * Location: scripts/atl2-c06-gate-c.self-test.mjs
 *
 * Not a product feature — evidence lock for Epic #1196 Gate C (#1211).
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
    pr: 1247,
    issue: 1206,
    sha: 'a79b7cfe594ddc8499f12951c1db9d3525bf6159',
    title: 'ATL2-C01 2D tools',
  },
  {
    pr: 1248,
    issue: 1207,
    sha: 'ec9b2f922aba0f50683bc371260f4c30d1578394',
    title: 'ATL2-C02 room/wall/door',
  },
  {
    pr: 1249,
    issue: 1208,
    sha: '3d5c3d8d8409c3bc0edb1d69ff5c007dc41d4ce1',
    title: 'ATL2-C03 layers/multi-select',
  },
  {
    pr: 1250,
    issue: 1209,
    sha: '3cf08c6bc1846210396c59f2ada03edad954659a',
    title: 'ATL2-C04 undo/autosave',
  },
  {
    pr: 1251,
    issue: 1210,
    sha: 'eb988119ec1a00f68485ff7c0fbf9c367d35b85f',
    title: 'ATL2-C05 adaptive workstation',
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

// --- Domain feature categories (C01–C05) ---
const poly = jiti(join(root, 'src/domains/world/atlas/canvas-polygon.ts'));
const ops = jiti(join(root, 'src/domains/world/atlas/map-edit-ops.ts'));
const canvas = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));
const sel = jiti(join(root, 'src/domains/world/atlas/atlas-selection.ts'));
const hist = jiti(join(root, 'src/domains/world/atlas/atlas-edit-history.ts'));
const ad = jiti(join(root, 'src/domains/world/atlas/atlas-workstation-adaptive.ts'));
const rev = jiti(join(root, 'src/domains/world/atlas/atlas-revision-contract.ts'));

const editorSrc = readFileSync(join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'), 'utf8');
const wbSrc = readFileSync(join(root, 'src/app/world/atlas/WorldAtlasWorkbench.tsx'), 'utf8');
const hookSrc = readFileSync(join(root, 'src/app/world/atlas/useWorldAtlasEditor.ts'), 'utf8');

assert.ok(editorSrc.includes('data-atlas-undo'));
assert.ok(editorSrc.includes('data-atlas-redo'));
assert.ok(editorSrc.includes('data-atlas-tool-rail'));
assert.ok(editorSrc.includes('data-atlas-layer-lock'));
assert.ok(editorSrc.includes('data-atlas-history-live'));
assert.ok(wbSrc.includes('data-atlas-content-band'));
assert.ok(hookSrc.includes('decideAtlasAutosave'));

let doc = canvas.emptyUnifiedCanvasDoc(false);
const square = [
  [0, 0],
  [12, 0],
  [12, 12],
  [0, 12],
];
assert.equal(poly.validateClosedPolygon(square).ok, true);
const room = canvas.roomFromValidatedPolygon('gate-c-room', 'stein', square);
assert.equal(room.ok, true);
doc = ops.applyMapEdit(doc, { op: 'add_room', room: room.room });
doc = ops.applyMapEdit(doc, {
  op: 'add_stroke',
  stroke: {
    id: 'gate-c-path',
    material: 'wasser',
    width: 1.2,
    points: [
      [1, 1],
      [8, 4],
    ],
  },
});
doc = ops.applyMapEdit(doc, {
  op: 'add_wall',
  wall: { id: 'gate-c-wall', x1: 0, y1: 0, x2: 10, y2: 0, width: 0.3 },
});
doc = ops.applyMapEdit(doc, {
  op: 'add_door',
  door: { id: 'gate-c-door', wallId: 'gate-c-wall', t: 0.4, width: 1 },
});
doc = ops.applyMapEdit(doc, {
  op: 'add_object',
  object: { id: 'gate-c-obj', type: 'haus', x: 4, y: 5, size: 2, angle: 0 },
});
assert.equal(doc.rooms.length, 1);
assert.equal(doc.strokes.length, 1);
assert.equal(doc.walls.length, 1);
assert.equal(doc.doors.length, 1);
assert.equal(doc.objects.length, 1);

doc = { ...doc, layerLocks: sel.setLayerLock({}, 'objects', true) };
assert.equal(sel.canEditFeatureKind(doc, 'object'), false);
const lockedTry = sel.translateSelected(doc, ['gate-c-obj'], 5, 0);
assert.equal(lockedTry.objects.find((o) => o.id === 'gate-c-obj').x, 4);
doc = { ...doc, layerLocks: sel.setLayerLock(doc.layerLocks, 'objects', false) };
assert.equal(sel.canEditFeatureKind(doc, 'object'), true);
const unlockedTry = sel.translateSelected(doc, ['gate-c-obj'], 5, 0);
assert.equal(unlockedTry.objects.find((o) => o.id === 'gate-c-obj').x, 9);
doc = unlockedTry;

let history = hist.emptyAtlasEditHistory();
history = hist.pushAtlasEdit(history, doc);
doc = ops.applyMapEdit(doc, { op: 'remove_object', id: 'gate-c-obj' });
assert.equal(doc.objects.length, 0);
const undone = hist.undoAtlasEdit(history, doc);
assert.ok(undone);
doc = undone.doc;
history = undone.history;
assert.equal(doc.objects.length, 1);
const redone = hist.redoAtlasEdit(history, doc);
assert.ok(redone);
doc = redone.doc;
assert.equal(doc.objects.length, 0);

doc = ops.applyMapEdit(doc, {
  op: 'add_object',
  object: { id: 'gate-c-obj', type: 'haus', x: 4, y: 5, size: 2, angle: 0 },
});
doc = ops.applyMapEdit(doc, { op: 'remove_wall', id: 'gate-c-wall' });
assert.equal(doc.walls.length, 0);
assert.equal(doc.doors.length, 0);

assert.equal(ad.resolveAtlasAdaptiveBand(390), 'phone');
assert.equal(ad.resolveAtlasWorkstationComposition(1280).showSideRails, true);
assert.equal(typeof rev.decideAtlasAutosave, 'function');

const phoneComp = ad.resolveAtlasWorkstationComposition(390);
assert.equal(phoneComp.reducedPhoneComposition, true);

const sollIst = [
  {
    category: 'Hierarchy travel (World→Krypta)',
    soll: 'ensure-starter yields ≥6 Golden map titles',
    ist: 'pending-host',
  },
  {
    category: 'Polygon / Path / Wall / Door / Object',
    soll: 'MapEditOps create+delete; empty arrays after last delete',
    ist: 'pass-domain',
  },
  {
    category: 'Layers / locks',
    soll: 'locked objects refuse translate; unlock restores edit',
    ist: 'pass-domain',
  },
  {
    category: 'Undo / Redo',
    soll: 'history restores object after remove; redo re-applies',
    ist: 'pass-domain',
  },
  {
    category: 'Adaptive / Touch chrome',
    soll: 'phone reduced composition; desktop side rails; editor markers',
    ist: 'pass-domain',
  },
  {
    category: 'Persist / Reload',
    soll: 'edited unifiedCanvas survives upsert + GET',
    ist: 'pending-host',
  },
  {
    category: 'Negative policy',
    soll: 'stale rev 40001; stranger 42501',
    ist: 'pending-host',
  },
];

// --- Live host: hierarchy + persist/reload + negatives ---
const work = mkdtempSync(join(tmpdir(), 'atl2-c06-'));
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
  conflict: false,
  strangerDeny: false,
  outsiderStatus: null,
};

const evidence = {
  gate: 'atl2-c06',
  issue: 1211,
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
    body: { email: 'gm-gate-c@sagatree.test', password: '1234', name: 'gm' },
  });
  assert.ok(ownerSign.res.status < 400, `owner sign-up ${ownerSign.res.status}`);
  let ownerCookie = ownerSign.cookie;
  if (!ownerCookie) {
    const si = await httpJson(hostUrl, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: hostUrl },
      body: { email: 'gm-gate-c@sagatree.test', password: '1234' },
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
  sollIst[0].ist = 'pass-host';

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

  const editedCanvas = canvas.serializeUnifiedCanvasDoc({
    ...canvas.emptyUnifiedCanvasDoc(false),
    rooms: [room.room],
    strokes: [
      {
        id: 'gate-c-path',
        material: 'wasser',
        width: 1.2,
        points: [
          [1, 1],
          [8, 4],
        ],
      },
    ],
    walls: [{ id: 'gate-c-wall', x1: 0, y1: 0, x2: 10, y2: 0, width: 0.3 }],
    doors: [{ id: 'gate-c-door', wallId: 'gate-c-wall', t: 0.4, width: 1 }],
    objects: [{ id: 'gate-c-obj', type: 'haus', x: 4, y: 5, size: 2, angle: 0 }],
  });

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
  assert.equal(reloadCanvas.objects?.length, 1);
  assert.equal(reloadCanvas.rooms?.length, 1);
  assert.equal(reloadCanvas.walls?.length, 1);
  assert.equal(reloadCanvas.doors?.length, 1);
  assert.equal(reloadCanvas.strokes?.length, 1);
  assert.equal(reloadCanvas.objects[0].id, 'gate-c-obj');
  hostEvidence.persistReload = true;
  sollIst[5].ist = 'pass-host';

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
    body: { email: 'stranger-gate-c@sagatree.test', password: '1234', name: 'stranger' },
  });
  let strangerCookie = strangerSign.cookie;
  if (!strangerCookie) {
    const si = await httpJson(hostUrl, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: hostUrl },
      body: { email: 'stranger-gate-c@sagatree.test', password: '1234' },
    });
    strangerCookie = si.cookie;
  }
  assert.ok(strangerCookie, 'stranger cookie required for cross-owner deny probe');
  const stranger = await httpJson(hostUrl, `/api/v1/worlds/${dornhain.id}/atlas/maps`, {
    method: 'PUT',
    headers: { Origin: hostUrl },
    cookie: strangerCookie,
    body: { ...saveBody, title: 'Hack', expectedRevision: savedRev },
  });
  assert.equal(
    stranger.json?.error,
    '42501',
    `stranger deny expected 42501 got ${stranger.res.status} ${stranger.text.slice(0, 200)}`,
  );
  hostEvidence.strangerDeny = true;

  const deniedList = await httpJson(hostUrl, `/api/v1/worlds/${dornhain.id}/atlas/maps`, {
    headers: { Origin: hostUrl },
    cookie: strangerCookie,
  });
  assert.ok(
    deniedList.res.status === 403 ||
      deniedList.res.status === 404 ||
      (deniedList.res.status === 200 && (deniedList.json?.maps?.length ?? 0) === 0),
    `outsider list deny got ${deniedList.res.status}`,
  );
  hostEvidence.outsiderStatus = deniedList.res.status;
  sollIst[6].ist = 'pass-host';

  evidence.verdict = 'CLEAR';
  evidence.residuals = [
    {
      severity: 'Low',
      item: 'Interactive pointer-draw drill in Browser E2E',
      note: 'Chrome markers + host persist/reload proven; full freehand stroke UX remains covered by C01 domain + product soak.',
      blocksGateC: false,
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

for (const row of sollIst) {
  assert.ok(
    String(row.ist).startsWith('pass-'),
    `Soll/Ist incomplete for ${row.category}: ${row.ist}`,
  );
}

const report = `# ATL2-C06 Gate C — Phase C 2D editor acceptance

- Issue: #1211
- HEAD: \`${evidence.head}\`
- Verdict: **${evidence.verdict}**
- Date: ${new Date().toISOString().slice(0, 10)}

## PR stack on main

| PR | Issue | Squash SHA | Present |
|----|-------|------------|---------|
${evidence.stack
  .map((s) => `| #${s.pr} | #${s.issue} | \`${s.sha.slice(0, 10)}\` ${s.title} | ${s.present ? 'yes' : 'NO'} |`)
  .join('\n')}

## Hierarchy travel (host)

- Owner ensure-starter → Dornhain atlas maps: **${hostEvidence.ownerMapCount}**
- Titles World→…→Krypta: yes
- World publicId: **${hostEvidence.worldPublicId ?? '(uuid-only)'}**

## Soll / Ist (feature categories)

| Category | Soll | Ist |
|----------|------|-----|
${sollIst.map((r) => `| ${r.category} | ${r.soll} | **${r.ist}** |`).join('\n')}

## Host CAS / ownership

- Persist + reload identity (room/path/wall/door/object): **${hostEvidence.persistReload ? 'yes' : 'no'}**
- Stale tab revision → 40001: **${hostEvidence.conflict ? 'yes' : 'no'}**
- Stranger write deny: **${hostEvidence.strangerDeny ? 'yes' : 'no'}**
- Outsider atlas list status: **${hostEvidence.outsiderStatus}**

## Residuals (non-blocking for Gate C)

${evidence.residuals.map((r) => `- **${r.severity}**: ${r.item} — ${r.note}`).join('\n')}

## Decision

Phase C 2D editor foundation is **${evidence.verdict}**. Phase D (#1212+) may open.
`;

const writeEvidence = process.env.ATL2_C06_WRITE_EVIDENCE === '1';
const outDir = writeEvidence ? join(root, '.qa/runs') : mkdtempSync(join(tmpdir(), 'atl2-c06-out-'));
writeFileSync(join(outDir, 'atl2-c06-gate-c.md'), report);
writeFileSync(join(outDir, 'atl2-c06-gate-c.json'), JSON.stringify(evidence, null, 2));

if (writeEvidence) {
  console.log(`wrote evidence to ${outDir}`);
}

// When evidence not yet committed, bootstrap once via WRITE_EVIDENCE; thereafter assert.
const committedPath = join(root, '.qa/runs/atl2-c06-gate-c.md');
let committed;
try {
  committed = readFileSync(committedPath, 'utf8');
} catch {
  committed = null;
}
if (committed) {
  assert.match(committed, /Verdict: \*\*CLEAR\*\*/);
  assert.match(committed, /#1247/);
  assert.match(committed, /#1251/);
} else {
  assert.equal(writeEvidence, true, 'first run must set ATL2_C06_WRITE_EVIDENCE=1 to seed .qa/runs');
}

assert.match(readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8'), /atl2-c06-gate-c\.self-test/);
assert.match(readFileSync(join(root, '.qa/acceptance/atl2-c06-gate-c.md'), 'utf8'), /ATL2-C06/);

console.log(`atl2-c06-gate-c self-test: PASS (${evidence.verdict})`);
console.log(`report: ${join(outDir, 'atl2-c06-gate-c.md')}${writeEvidence ? '' : ' (transient)'}`);

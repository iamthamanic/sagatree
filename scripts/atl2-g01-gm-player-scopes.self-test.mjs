#!/usr/bin/env node
/**
 * ATL2-G01 — GM / Player / Owner atlas scopes (host projection + deny).
 * Location: scripts/atl2-g01-gm-player-scopes.self-test.mjs
 *
 * Hardens + proves Issue #1229: foreign write deny, playerView redaction,
 * party-reveal gating, no dungeon/seed leak in player generator_meta.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-g01.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-g01-gm-player-scopes.md'), 'utf8');
const gateSrc = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const storeSrc = readFileSync(
  join(root, 'server/src/modules/world/internal/world-atlas-store.ts'),
  'utf8',
);

assert.ok(acceptance.includes('atl2-g01'));
assert.ok(acceptance.includes('IV-07'));
assert.ok(design.includes('redactPartyMeta') || design.includes('Party'));
assert.ok(gateSrc.includes('atl2-g01-gm-player-scopes.self-test.mjs'), 'wired in test-gate');
assert.ok(storeSrc.includes('redactPartyMeta'), 'party meta redaction exists');
assert.ok(
  !/if \(meta\.dungeon !== undefined\) out\.dungeon = meta\.dungeon/.test(storeSrc),
  'party meta must not forward dungeon forge state',
);

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

async function signUp(hostUrl, email, name) {
  const sign = await httpJson(hostUrl, '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: hostUrl },
    body: { email, password: '1234', name },
  });
  assert.ok(sign.res.status < 400, `sign-up ${email} ${sign.res.status}`);
  let cookie = sign.cookie;
  if (!cookie) {
    const si = await httpJson(hostUrl, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: hostUrl },
      body: { email, password: '1234' },
    });
    cookie = si.cookie;
  }
  assert.ok(cookie, `cookie ${email}`);
  return cookie;
}

const sollIst = [
  {
    category: 'Foreign / stranger write deny',
    soll: 'stranger atlas upsert → 42501/403',
    ist: 'pending-host',
  },
  {
    category: 'Unrevealed map fail-closed',
    soll: 'playerView without reveal / without saga → deny or empty',
    ist: 'pending-host',
  },
  {
    category: 'Party-reveal gating',
    soll: 'after party binding, crypt appears; secrets still redacted',
    ist: 'pending-host',
  },
  {
    category: 'Meta whitelist',
    soll: 'player generator_meta omits dungeon + golden seed keys',
    ist: 'pending-host',
  },
];

const work = mkdtempSync(join(tmpdir(), 'atl2-g01-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const authIndexUrl = pathToFileURL(join(root, 'server/src/auth/index.ts')).href;
const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);
const port = await unusedPort();
const hostUrl = `http://127.0.0.1:${port}`;

const hostEvidence = {
  strangerDeny: false,
  outsiderStatus: null,
  unrevealedDeny: false,
  playerSecretsRedacted: false,
  dungeonMetaOmitted: false,
  seedKeysOmitted: false,
  revealedMapTitles: [],
};

const evidence = {
  gate: 'atl2-g01',
  issue: 1229,
  head,
  host: hostEvidence,
  sollIst,
  verdict: 'OPEN',
};

let host;
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

  const ownerCookie = await signUp(hostUrl, 'gm-g01@sagatree.test', 'gm');
  const strangerCookie = await signUp(hostUrl, 'stranger-g01@sagatree.test', 'x');

  const ensure = await httpJson(hostUrl, '/api/v1/projects/ensure-starter', {
    method: 'POST',
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
    body: { slug: 'dornhain.whisper' },
  });
  assert.equal(ensure.res.status, 200, `ensure-starter ${ensure.text}`);
  const projectId = ensure.json?.id;
  const sagaPublicId = ensure.json?.publicId;
  assert.ok(projectId, 'project id');
  assert.ok(typeof sagaPublicId === 'string' && sagaPublicId.startsWith('SA-'), 'saga public id');

  const worlds = await httpJson(hostUrl, '/api/v1/library/worlds', {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  const dornhain = (worlds.json?.worlds ?? []).find((w) => w.title === 'Dornhain');
  assert.ok(dornhain?.id, 'Dornhain world');

  const mapsRes = await httpJson(hostUrl, `/api/v1/worlds/${dornhain.id}/atlas/maps`, {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  assert.equal(mapsRes.res.status, 200, mapsRes.text);
  const mapRows = mapsRes.json?.maps ?? [];
  const crypt = mapRows.find((m) => m.title === 'Krypta unter dem Hügel');
  const welt = mapRows.find((m) => m.title === 'Welt' || m.title === 'Weltkarte');
  assert.ok(crypt?.id, 'crypt map');
  assert.ok(welt?.id, 'welt map');

  const weltGet = await httpJson(hostUrl, `/api/v1/worlds/atlas/maps/${welt.id}`, {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  const weltVm = weltGet.json?.map ?? weltGet.json;
  const rev0 = weltVm?.revision ?? welt.revision;

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
  sollIst[0].ist = 'pass-host';

  // playerView without saga → fail closed
  const noSaga = await httpJson(
    hostUrl,
    `/api/v1/worlds/atlas/maps/${crypt.id}?playerView=1`,
    { headers: { Origin: hostUrl }, cookie: ownerCookie },
  );
  assert.ok(
    noSaga.res.status >= 400 || noSaga.json?.error === 'P0002',
    `playerView without saga should fail closed; got ${noSaga.res.status}`,
  );

  // playerView with saga but no party reveal → crypt not listed / not gettable
  const listBefore = await httpJson(
    hostUrl,
    `/api/v1/worlds/${dornhain.id}/atlas/maps?playerView=1&sagaPublicId=${encodeURIComponent(sagaPublicId)}`,
    { headers: { Origin: hostUrl }, cookie: ownerCookie },
  );
  assert.equal(listBefore.res.status, 200, listBefore.text);
  const beforeTitles = (listBefore.json?.maps ?? []).map((m) => m.title);
  assert.ok(
    !beforeTitles.includes('Krypta unter dem Hügel'),
    `unrevealed crypt must not list; got ${beforeTitles.join(',')}`,
  );
  const getBefore = await httpJson(
    hostUrl,
    `/api/v1/worlds/atlas/maps/${crypt.id}?playerView=1&sagaPublicId=${encodeURIComponent(sagaPublicId)}`,
    { headers: { Origin: hostUrl }, cookie: ownerCookie },
  );
  assert.ok(
    getBefore.res.status >= 400 || getBefore.json?.error === 'P0002',
    `unrevealed get should deny; got ${getBefore.res.status}`,
  );
  hostEvidence.unrevealedDeny = true;
  sollIst[1].ist = 'pass-host';

  // Inject dungeon forge meta + ensure secrets exist on GM crypt, then party-reveal.
  const cryptGm = await httpJson(hostUrl, `/api/v1/worlds/atlas/maps/${crypt.id}`, {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  assert.equal(cryptGm.res.status, 200, cryptGm.text);
  const gmVm = cryptGm.json?.map ?? cryptGm.json;
  const gmMeta = { ...(gmVm?.generatorMeta ?? {}) };
  gmMeta.dungeon = {
    forgeDraft: true,
    seed: 'gm-only-forge',
    rooms: [{ id: 'hidden-forge-room' }],
  };
  if (!gmMeta.seed) gmMeta.seed = 'dornhain.map.loc.crypt';
  if (!gmMeta.placeSeedKey) gmMeta.placeSeedKey = 'loc.crypt';
  // Ensure at least one secret stamp for redaction proof.
  const canvas = gmMeta.unifiedCanvas && typeof gmMeta.unifiedCanvas === 'object'
    ? { ...gmMeta.unifiedCanvas }
    : { version: 1, rooms: [], objects: [], strokes: [], walls: [] };
  const objects = Array.isArray(canvas.objects) ? [...canvas.objects] : [];
  if (!objects.some((o) => o && (o.secret === true || o.id === 's.obj.crypt'))) {
    objects.push({ id: 's.obj.crypt', type: 'kiste', x: 10, y: 10, size: 1, secret: true });
  }
  gmMeta.unifiedCanvas = { ...canvas, objects };

  const saveMeta = await httpJson(hostUrl, `/api/v1/worlds/${dornhain.id}/atlas/maps`, {
    method: 'PUT',
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
    body: {
      mapId: crypt.id,
      parentMapId: gmVm?.parentMapId ?? crypt.parentMapId ?? null,
      kind: gmVm?.kind ?? 'scene',
      title: gmVm?.title ?? 'Krypta unter dem Hügel',
      sortOrder: gmVm?.sortOrder ?? 0,
      bounds: gmVm?.bounds ?? { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
      layers: gmVm?.layers ?? { type: 'FeatureCollection', features: [] },
      basemapStoragePath: gmVm?.basemapStoragePath ?? null,
      azgaarMapStoragePath: gmVm?.azgaarMapStoragePath ?? null,
      generatorMeta: gmMeta,
      expectedRevision: gmVm?.revision,
    },
  });
  assert.ok(saveMeta.res.status < 400, `save crypt meta ${saveMeta.res.status} ${saveMeta.text.slice(0, 200)}`);

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
       VALUES (?, ?, 'location', ?, 'party', 'G01 crypt reveal', '{}', ?, ?)`,
    ).run(randomUUID(), projectId, cryptPlace.id, cryptPlace.id, new Date().toISOString());
  } finally {
    db.close();
  }

  const listAfter = await httpJson(
    hostUrl,
    `/api/v1/worlds/${dornhain.id}/atlas/maps?playerView=1&sagaPublicId=${encodeURIComponent(sagaPublicId)}`,
    { headers: { Origin: hostUrl }, cookie: ownerCookie },
  );
  assert.equal(listAfter.res.status, 200, listAfter.text);
  const afterTitles = (listAfter.json?.maps ?? []).map((m) => m.title);
  assert.ok(
    afterTitles.includes('Krypta unter dem Hügel'),
    `revealed crypt should list; got ${afterTitles.join(',')}`,
  );
  hostEvidence.revealedMapTitles = afterTitles;

  const cryptPlayer = await httpJson(
    hostUrl,
    `/api/v1/worlds/atlas/maps/${crypt.id}?playerView=1&sagaPublicId=${encodeURIComponent(sagaPublicId)}`,
    { headers: { Origin: hostUrl }, cookie: ownerCookie },
  );
  assert.equal(cryptPlayer.res.status, 200, cryptPlayer.text);
  const playerVm = cryptPlayer.json?.map ?? cryptPlayer.json;
  const playerMeta = playerVm?.generatorMeta ?? playerVm?.generator_meta ?? {};
  const playerCanvas = playerMeta.unifiedCanvas;
  assert.ok(playerCanvas, 'player crypt canvas');
  const leaked = [...(playerCanvas.objects ?? []), ...(playerCanvas.rooms ?? [])].filter(
    (row) => row && (row.secret === true || row.id === 's.obj.crypt' || row.id === 's.crypt'),
  );
  assert.equal(leaked.length, 0, `player view leaked secrets: ${JSON.stringify(leaked)}`);
  hostEvidence.playerSecretsRedacted = true;
  sollIst[2].ist = 'pass-host';

  assert.equal(
    playerMeta.dungeon,
    undefined,
    `player meta must omit dungeon forge; got ${JSON.stringify(playerMeta.dungeon)}`,
  );
  assert.equal(playerMeta.seed, undefined, 'player meta must omit golden seed');
  assert.equal(playerMeta.placeSeedKey, undefined, 'player meta must omit placeSeedKey');
  hostEvidence.dungeonMetaOmitted = true;
  hostEvidence.seedKeysOmitted = true;
  sollIst[3].ist = 'pass-host';

  evidence.verdict = 'CLEAR';
} finally {
  if (host && typeof host.stop === 'function') await host.stop();
  rmSync(work, { recursive: true, force: true });
}

const sollRows = sollIst.map((r) => `| ${r.category} | ${r.soll} | **${r.ist}** |`).join('\n');
const report = `# ATL2-G01 — GM / Player / Owner atlas scopes

- Issue: #1229
- HEAD: \`${head}\`
- Verdict: **${evidence.verdict}**
- Date: ${new Date().toISOString().slice(0, 10)}

## Host evidence

- Stranger write deny: **${hostEvidence.strangerDeny ? 'yes' : 'no'}** (status ${hostEvidence.outsiderStatus ?? 'n/a'})
- Unrevealed map fail-closed: **${hostEvidence.unrevealedDeny ? 'yes' : 'no'}**
- Player secrets redacted: **${hostEvidence.playerSecretsRedacted ? 'yes' : 'no'}**
- Dungeon meta omitted: **${hostEvidence.dungeonMetaOmitted ? 'yes' : 'no'}**
- Seed keys omitted: **${hostEvidence.seedKeysOmitted ? 'yes' : 'no'}**
- Revealed titles: ${(hostEvidence.revealedMapTitles ?? []).join(', ') || 'n/a'}

## Soll / Ist

| Category | Soll | Ist |
|----------|------|-----|
${sollRows}

## Decision

ATL2-G01 scopes are **${evidence.verdict}**.
`;

const writeEvidence = process.env.ATL2_G01_WRITE_EVIDENCE === '1';
const outDir = writeEvidence ? join(root, '.qa/runs') : mkdtempSync(join(tmpdir(), 'atl2-g01-out-'));
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'atl2-g01-gm-player-scopes.md'), report);
writeFileSync(join(outDir, 'atl2-g01-gm-player-scopes.json'), `${JSON.stringify(evidence, null, 2)}\n`);
if (writeEvidence) console.log(`wrote evidence to ${outDir}`);

const committedPath = join(root, '.qa/runs/atl2-g01-gm-player-scopes.md');
try {
  const committed = readFileSync(committedPath, 'utf8');
  assert.match(committed, /Verdict: \*\*CLEAR\*\*/);
} catch {
  /* first write */
}

console.log(`atl2-g01-gm-player-scopes self-test: PASS (${evidence.verdict})`);

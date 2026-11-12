#!/usr/bin/env node
/**
 * ATL2-A04 Gate A — Phase A foundation protocol (host + PR stack).
 * Location: scripts/atl2-a04-gate-a.self-test.mjs
 *
 * Not a product feature — evidence lock for Epic #1196 Gate A.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED_MAP_TITLES = [
  'Welt',
  'Kontinent Westmark',
  'Land Westmark',
  'Dornhain',
  'Taverne Zum Flüstern',
  'Krypta unter dem Hügel',
];

const STACK = [
  { pr: 1239, issue: 1197, sha: '83d9da8c3607fe49306e76dd63f72f8acece3ed8', title: 'ATL2-A01 parity' },
  { pr: 1194, issue: 1198, sha: '540b40ac8150f5053bc7c5e8fca470e0d7b40fb9', title: 'Golden v4' },
  { pr: 1195, issue: 1198, sha: 'd3e3f2b71db41e48f34d8ea17d49b5782efa7c84', title: 'Golden Steps 1–6' },
  { pr: 1240, issue: 1199, sha: 'f351b8c3fea873977334a524cb3ad9fc9ef54793', title: 'Cold bootstrap A03' },
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

// --- PR stack on current HEAD ---
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

// --- Live host cold bootstrap + negatives ---
const work = mkdtempSync(join(tmpdir(), 'atl2-a04-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const createHostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const authIndexUrl = pathToFileURL(join(root, 'server/src/auth/index.ts')).href;
const { createHost } = await import(createHostUrl);
const { generateAuthSecret } = await import(authIndexUrl);
const port = await unusedPort();
const hostUrl = `http://127.0.0.1:${port}`;

let host;
const evidence = {
  gate: 'atl2-a04',
  issue: 1200,
  head,
  stack: stackStatus,
  host: {},
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
    body: { email: 'gm-gate-a@sagatree.test', password: '1234', name: 'gm' },
  });
  assert.ok(ownerSign.res.status < 400, `owner sign-up ${ownerSign.res.status}`);
  let ownerCookie = ownerSign.cookie;
  if (!ownerCookie) {
    const si = await httpJson(hostUrl, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: hostUrl },
      body: { email: 'gm-gate-a@sagatree.test', password: '1234' },
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

  const maps = await httpJson(hostUrl, `/api/v1/worlds/${dornhain.id}/atlas/maps`, {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  assert.equal(maps.res.status, 200, maps.text);
  const titles = (maps.json?.maps ?? []).map((m) => m.title);
  for (const t of EXPECTED_MAP_TITLES) {
    assert.ok(titles.includes(t), `missing map title ${t}; got ${titles.join(',')}`);
  }
  evidence.host.ownerMapCount = titles.length;
  evidence.host.ownerMapTitles = titles;

  // Outsider must not see owner atlas maps
  const strangerSign = await httpJson(hostUrl, '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { Origin: hostUrl },
    body: { email: 'stranger-gate-a@sagatree.test', password: '1234', name: 'stranger' },
  });
  let strangerCookie = strangerSign.cookie;
  if (!strangerCookie) {
    const si = await httpJson(hostUrl, '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: hostUrl },
      body: { email: 'stranger-gate-a@sagatree.test', password: '1234' },
    });
    strangerCookie = si.cookie;
  }
  const denied = await httpJson(hostUrl, `/api/v1/worlds/${dornhain.id}/atlas/maps`, {
    headers: { Origin: hostUrl },
    cookie: strangerCookie,
  });
  assert.ok(
    denied.res.status === 403 ||
      denied.res.status === 404 ||
      (denied.res.status === 200 && (denied.json?.maps?.length ?? 0) === 0),
    `outsider atlas deny got ${denied.res.status} ${denied.text.slice(0, 200)}`,
  );
  evidence.host.outsiderStatus = denied.res.status;

  const sagaPublicId = ensure.json?.publicId;
  assert.ok(typeof sagaPublicId === 'string' && sagaPublicId.startsWith('SA-'), 'saga public id');

  const cryptSummary = (maps.json?.maps ?? []).find((m) => m.title === 'Krypta unter dem Hügel');
  assert.ok(cryptSummary?.id, 'crypt map summary');
  const cryptGm = await httpJson(hostUrl, `/api/v1/worlds/atlas/maps/${cryptSummary.id}`, {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  assert.equal(cryptGm.res.status, 200, cryptGm.text);
  const gmCanvas = cryptGm.json?.generatorMeta?.unifiedCanvas ?? cryptGm.json?.map?.generatorMeta?.unifiedCanvas;
  const gmMeta =
    cryptGm.json?.generatorMeta ??
    cryptGm.json?.map?.generatorMeta ??
    cryptGm.json?.generator_meta ??
    null;
  const canvas = gmMeta?.unifiedCanvas ?? gmCanvas;
  assert.ok(canvas, `crypt GM canvas missing: ${cryptGm.text.slice(0, 300)}`);
  const gmSecretIds = [
    ...(canvas.objects ?? []),
    ...(canvas.rooms ?? []),
  ]
    .filter((row) => row && (row.secret === true || row.id === 'g.crypt.relic' || String(row.id || '').includes('crypt')))
    .map((row) => row.id);
  assert.ok(gmSecretIds.length >= 1, `GM crypt canvas should include secret/crypt entities, got ${JSON.stringify(canvas.objects)}`);

  // Party-reveal the crypt place so playerView is nonempty, then assert redaction.
  const places = await httpJson(hostUrl, `/api/v1/worlds/${dornhain.id}/places`, {
    headers: { Origin: hostUrl },
    cookie: ownerCookie,
  });
  const cryptPlace = (places.json?.places ?? []).find((p) => p.seedKey === 'loc.crypt' || p.name === 'Krypta unter dem Hügel');
  assert.ok(cryptPlace?.id, 'crypt place');
  const dbPath = join(dataDir, 'host.sqlite');
  const db = new DatabaseSync(dbPath);
  try {
    db.prepare(
      `INSERT INTO saga_asset_bindings
         (id, project_id, asset_kind, asset_id, reveal, label, metadata, world_place_id, updated_at)
       VALUES (?, ?, 'location', ?, 'party', 'Gate A crypt reveal', '{}', ?, ?)`,
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
    cryptPlayer.json?.generatorMeta ??
    cryptPlayer.json?.map?.generatorMeta ??
    null;
  const playerCanvas = playerMeta?.unifiedCanvas;
  assert.ok(playerCanvas, 'player crypt canvas');
  const leaked = [...(playerCanvas.objects ?? []), ...(playerCanvas.rooms ?? [])].filter(
    (row) => row && (row.secret === true || row.id === 's.obj.crypt' || row.id === 's.crypt'),
  );
  assert.equal(leaked.length, 0, `player view leaked secrets: ${JSON.stringify(leaked)}`);
  evidence.host.playerViewRedaction = true;
  evidence.host.playerViewMapCount = 1;

  evidence.verdict = 'CLEAR';
  evidence.residuals = [
    {
      severity: 'Medium',
      item: 'Editor Golden-reset dialog hang / full UI drill',
      note: 'Not required for Gate A fresh-start journey; track in Phase C editor UX / gap-audit residual.',
      blocksGateA: false,
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

const report = `# ATL2-A04 Gate A — Phase A acceptance

- Issue: #1200
- HEAD: \`${evidence.head}\`
- Verdict: **${evidence.verdict}**
- Date: ${new Date().toISOString().slice(0, 10)}

## PR stack on main

| PR | Issue | Squash SHA | Present |
|----|-------|------------|---------|
${evidence.stack
  .map((s) => `| #${s.pr} | #${s.issue} | \`${s.sha.slice(0, 10)}\` ${s.title} | ${s.present ? 'yes' : 'NO'} |`)
  .join('\n')}

## Host cold bootstrap (live)

- Owner ensure-starter → Dornhain atlas maps: **${evidence.host.ownerMapCount}**
- Titles include Westmark hierarchy + Taverne/Krypta: yes
- Outsider atlas status: **${evidence.host.outsiderStatus}** (deny/empty)
- Player-view crypt redaction: **${evidence.host.playerViewRedaction ? 'yes' : 'no'}**

## Residuals (non-blocking for Gate A)

${evidence.residuals.map((r) => `- **${r.severity}**: ${r.item} — ${r.note}`).join('\n')}

## Decision

Phase A foundation is **${evidence.verdict}**. Phase B (#1201+) may open.
`;

// P2: never rewrite committed evidence from test-gate. Optional explicit write only.
const writeEvidence = process.env.ATL2_A04_WRITE_EVIDENCE === '1';
const outDir = writeEvidence ? join(root, '.qa/runs') : mkdtempSync(join(tmpdir(), 'atl2-a04-out-'));
const reportPath = join(outDir, 'atl2-a04-gate-a.md');
writeFileSync(reportPath, report);
writeFileSync(join(outDir, 'atl2-a04-gate-a.json'), JSON.stringify(evidence, null, 2));

const committed = readFileSync(join(root, '.qa/runs/atl2-a04-gate-a.md'), 'utf8');
assert.match(committed, /Verdict: \*\*CLEAR\*\*/);
assert.match(committed, /#1239/);
assert.match(committed, /#1240/);

assert.match(readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8'), /atl2-a04-gate-a\.self-test/);
assert.match(readFileSync(join(root, '.qa/acceptance/atl2-a04-gate-a.md'), 'utf8'), /ATL2-A04/);

console.log(`atl2-a04-gate-a self-test: PASS (${evidence.verdict})`);
console.log(`report: ${reportPath}${writeEvidence ? '' : ' (transient)'}`);

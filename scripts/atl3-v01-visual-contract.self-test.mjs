#!/usr/bin/env node
/**
 * ATL3-V01 — visual quality contract / Golden scenes oracle (#1295).
 * Location: scripts/atl3-v01-visual-contract.self-test.mjs
 *
 * Checks the machine-readable contract against the real Golden domain data
 * (stored-map builders, light profiles, camera clamps, perf budgets), the
 * Soll/Ist matrix completeness, the committed Custom-WebGL baseline set and
 * the browser capture spec. It never claims visual quality: GAP rows stay GAP.
 * ATL3_V01_WRITE_EVIDENCE=1 pins `.qa/runs/atl3-v01-visual-contract.{md,json}`.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const CONTRACT_REL = '.qa/fixtures/atl3-v01-visual-contract/golden-scenes.json';
const contract = JSON.parse(read(CONTRACT_REL));
const design = read('.qa/design/atl3-procedural-fantasy-rendering.md');
const acceptance = read('.qa/acceptance/atl3-v01-visual-contract.md');
const gate = read('scripts/test-gate.mjs');
const e2eSrc = read('e2e/atl3-v01-visual-contract.spec.ts');

const golden = jiti(join(root, 'src/domains/world/atlas/dornhain-golden-hierarchy.ts'));
const diorama = jiti(join(root, 'src/domains/world/atlas/atlas-diorama-look.ts'));
const dungeon = jiti(join(root, 'src/domains/world/atlas/atlas-dungeon-look.ts'));
const camera = jiti(join(root, 'src/domains/world/atlas/atlas-product-camera.ts'));
const perf = jiti(join(root, 'src/domains/world/atlas/atlas-perf-budgets.ts'));
const target = jiti(join(root, 'src/domains/world/atlas/atlas-renderer-target.ts'));

const rows = [];
const row = (id, status, detail) => rows.push({ id, status, detail });

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
function featureFingerprint(doc) {
  const pick = {
    rooms: doc.rooms ?? [],
    walls: doc.walls ?? [],
    doors: doc.doors ?? [],
    objects: doc.objects ?? [],
    strokes: doc.strokes ?? [],
    heightfield: doc.heightfield ?? null,
  };
  return createHash('sha256').update(canonicalJson(pick)).digest('hex').slice(0, 16);
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/* 1) Contract shape */
assert.equal(contract.format, 'atl3-v01-visual-contract-v1');
assert.equal(contract.issue, 1295);
assert.equal(contract.baselineRenderer, target.ATLAS_PRODUCT_3D_TARGET, 'baseline must be the productive renderer');
assert.equal(contract.worldSeed, golden.DORNHAIN_WORLD_MAP_SEED);
assert.deepEqual(
  contract.scenes.map((s) => s.id),
  ['dornhain-block', 'krypta'],
  'V01 scenes are exactly Dornhain block + Krypta',
);
assert.deepEqual(
  contract.cameras.map((c) => c.id),
  [...camera.ATLAS_PRODUCT_CAMERA_MODES],
  'all three product camera modes',
);
row('contract-shape', 'PASS', `scenes=${contract.scenes.length} cameras=${contract.cameras.length}`);

/* 2) Fixed stored data: scenes resolve to real Golden maps; fingerprints pinned */
const builders = { buildGoldenDornhainCanvas: golden.buildGoldenDornhainCanvas, buildGoldenCryptCanvas: golden.buildGoldenCryptCanvas };
const docs = {};
for (const scene of contract.scenes) {
  const spec = golden.DORNHAIN_GOLDEN_MAPS.find((m) => m.seedKey === scene.mapSeedKey);
  assert.ok(spec, `${scene.id}: mapSeedKey ${scene.mapSeedKey} is a Golden map`);
  assert.equal(spec.title, scene.mapTitleDe, `${scene.id}: title`);
  assert.equal(spec.kind, scene.mapKind, `${scene.id}: kind`);
  assert.equal(spec.buildCanvas, builders[scene.domainBuilder], `${scene.id}: domain builder`);
  assert.equal(scene.navDrill.at(-1), scene.mapTitleDe, `${scene.id}: drill ends at map`);
  const doc = spec.buildCanvas();
  docs[scene.id] = doc;
  const fp = featureFingerprint(doc);
  assert.equal(fp, scene.dataFingerprint, `${scene.id}: Golden data drifted (${fp}) — update contract + baseline deliberately`);
  const ids = new Set([...doc.rooms, ...doc.walls, ...(doc.doors ?? []), ...doc.objects, ...doc.strokes].map((f) => f.id));
  for (const id of scene.requiredFeatureIds) assert.ok(ids.has(id), `${scene.id}: feature ${id} exists in stored data`);
  row(`stored-data-${scene.id}`, 'PASS', `seed=${scene.mapSeedKey} fp=${fp} features=${ids.size}`);
}

/* 3) Light profiles pinned to domain (drift = deliberate contract change) */
{
  const dl = diorama.resolveAtlasDioramaLightProfile('balanced');
  const lp = contract.scenes[0].lightProfile;
  assert.deepEqual([...dl.daylightDir], lp.daylightDir);
  assert.ok(near(dl.ambient, lp.ambient) && near(dl.fogDensity, lp.fogDensity) && near(dl.shadowStrength, lp.shadowStrength));
  assert.equal(dl.detailLevel, lp.detailLevel);
  const kl = dungeon.resolveAtlasDungeonLightProfile(contract.scenes[1].dungeonThemeKey, 'balanced');
  const kp = contract.scenes[1].lightProfile;
  assert.deepEqual([...kl.daylightDir], kp.daylightDir);
  assert.ok(near(kl.ambient, kp.ambient) && near(kl.fogDensity, kp.fogDensity) && near(kl.shadowStrength, kp.shadowStrength));
  assert.ok(near(kl.torchIntensity, kp.torchIntensity));
  row('light-profiles', 'PASS', `diorama=${dl.presetId} dungeon=${kl.themeKey}/${kl.presetId}`);
}

/* 4) Cameras + zoom ladder within product clamps */
for (const cam of contract.cameras) {
  assert.ok(near(cam.pitchRad, camera.pitchForMode(cam.id), 1e-6), `${cam.id}: pitch = product default`);
  assert.ok(near(camera.clampPitchForMode(cam.id, cam.pitchRad), cam.pitchRad, 1e-6), `${cam.id}: pitch inside clamp`);
}
assert.ok(near(contract.cameras[2].fovYDeg, (camera.ATLAS_PERSPECTIVE_FOV_Y * 180) / Math.PI, 1e-6), 'perspective FOV');
for (const scene of contract.scenes) {
  assert.ok(scene.zoomLevels.length >= 3, `${scene.id}: ≥3 zoom levels`);
  let prev = 0;
  for (const z of scene.zoomLevels) {
    assert.match(z.id, /^z[0-9]-[a-z0-9-]+$/);
    assert.ok(z.zoomPercent > prev, `${scene.id}: zoom ladder ascending`);
    prev = z.zoomPercent;
    const span = (contract.zoomSpanBase * 100) / z.zoomPercent;
    const clamped = camera.clampAtlasProductCamera({ mode: 'ortho-topdown', x: z.center[0], z: z.center[1], span, yawRad: 0, pitchRad: Math.PI / 2 });
    assert.ok(near(clamped.span, span, 1e-9), `${scene.id}/${z.id}: span inside product clamp`);
  }
}
row('cameras-zoom', 'PASS', contract.scenes.map((s) => `${s.id}:${s.zoomLevels.map((z) => z.zoomPercent).join('/')}%`).join(' '));

/* 5) Ist facts the matrix relies on are still true in the domain (no silent drift) */
{
  const plan = diorama.buildAtlasDioramaLookPlan(docs['dornhain-block'], { graphicsPresetId: 'balanced' });
  assert.equal(diorama.atlasDioramaLookPlanIsCanonicalOnly(plan), true, 'C-AUTH-01: diorama plan canonical-only');
  const roofTokens = plan.materials.filter((m) => m.id.startsWith('roof')).length;
  const treeVariants = new Set(plan.batches.filter((b) => b.kind === 'tree').map((b) => b.variant)).size;
  const krypta = docs.krypta;
  const kPlan = dungeon.buildAtlasDungeonLookPlan(krypta, { themeKey: contract.scenes[1].dungeonThemeKey, graphicsPresetId: 'balanced' });
  const facts = {
    dornhainRoofTokens: roofTokens,
    dornhainTreeVariants: treeVariants,
    dornhainHeightfield: docs['dornhain-block'].heightfield ? 'present' : 'none',
    kryptaRooms: krypta.rooms.length,
    kryptaWalls: krypta.walls.length,
    kryptaDoors: (krypta.doors ?? []).length,
    kryptaDungeonLookTorches: kPlan.counts.torches,
    kryptaDungeonLookInstances: kPlan.counts.instances,
  };
  const crit = (id) => contract.criteria.find((c) => c.id === id);
  // If the domain improves, the GAP/PARTIAL row must be re-evaluated, not left stale.
  if (roofTokens < 3) assert.equal(crit('D-GEO-01').status, 'GAP');
  if (treeVariants >= 3) assert.notEqual(crit('D-GEO-02').status, 'GAP');
  if (facts.dornhainHeightfield === 'none') assert.equal(crit('D-GEO-03').status, 'GAP');
  if (facts.kryptaDoors === 0) assert.equal(crit('K-GEO-01').status, 'GAP');
  if (facts.kryptaDungeonLookTorches === 0) assert.equal(crit('K-LIT-01').status, 'GAP');
  row('ist-facts', 'PASS', JSON.stringify(facts));
  contract.__facts = facts;
}

/* 6) Soll/Ist matrix completeness — observable, not taste */
const allowed = new Set(contract.statusValues);
const areasPerScene = {
  'dornhain-block': ['geometry', 'material', 'light', 'lod', 'readability', 'artifact'],
  krypta: ['geometry', 'material', 'light', 'atmosphere', 'artifact'],
  '*': ['camera', 'determinism', 'data', 'adaptive', 'quality-profile', 'performance', 'authority', 'security'],
};
const taste = /\b(premium|cinematic|immersive|smooth|magical|high quality|schön|hochwertig|stimmungsvoll)\b/i;
const ids = new Set();
for (const c of contract.criteria) {
  assert.ok(!ids.has(c.id), `duplicate criterion ${c.id}`);
  ids.add(c.id);
  for (const k of ['scene', 'area', 'authority', 'metric', 'soll', 'ist', 'status', 'evidence']) {
    assert.ok(typeof c[k] === 'string' && c[k].trim(), `${c.id}: ${k}`);
  }
  assert.ok(allowed.has(c.status), `${c.id}: status ${c.status}`);
  assert.ok(['canonical', 'suggestive', 'atmospheric'].includes(c.authority), `${c.id}: authority`);
  assert.ok(/[0-9≥≤±]/.test(c.soll), `${c.id}: Soll must carry an observable threshold`);
  assert.ok(!taste.test(c.soll), `${c.id}: taste word in Soll`);
}
for (const [scene, areas] of Object.entries(areasPerScene)) {
  for (const area of areas) {
    assert.ok(contract.criteria.some((c) => c.scene === scene && c.area === area), `matrix covers ${scene}/${area}`);
  }
}
const statusCount = Object.fromEntries(contract.statusValues.map((s) => [s, contract.criteria.filter((c) => c.status === s).length]));
row('soll-ist-matrix', 'PASS', `criteria=${contract.criteria.length} ${JSON.stringify(statusCount)}`);

/* 7) Budgets for real hardware + software ceiling labelled */
{
  const tiers = contract.hardwareBudgets.map((b) => b.tier);
  assert.deepEqual(tiers, ['desktop-reference', 'tablet', 'phone-low-end']);
  for (const b of contract.hardwareBudgets) {
    for (const k of ['frameP50Ms', 'frameP95Ms', 'firstFrameAfterMapOpenMs', 'drawCallsMax', 'trianglesMax', 'gpuMemoryMbMax', 'proceduralTextureMaxPx', 'heapGrowthAfter8MapSwitchesMbMax']) {
      assert.ok(Number.isFinite(b[k]) && b[k] > 0, `${b.tier}.${k}`);
    }
    assert.ok(b.frameP95Ms <= perf.ATLAS_PERF_BUDGET_THRESHOLDS.frameP95MsSoft, `${b.tier}: p95 not looser than G02 soft budget`);
    assert.ok(target.ATLAS_GRAPHICS_PRESETS.some((p) => p.id === b.preset), `${b.tier}: preset`);
  }
  const ib = contract.instanceBudgets;
  const t = perf.ATLAS_PERF_BUDGET_THRESHOLDS;
  assert.deepEqual([ib.high, ib.balanced, ib.lite], [t.maxInstancesHigh, t.maxInstancesBalanced, t.maxInstancesLite]);
  assert.equal(contract.ciSoftwareCeiling.renderer, 'software-webgl');
  row('budgets', 'PASS', `tiers=${tiers.join(',')} ciCeiling=${contract.ciSoftwareCeiling.frameP95Ms}ms (software only)`);
}

/* 8) Committed Custom-WebGL baseline set (Ist evidence) */
const baseDir = join(root, contract.baseline.dir);
const manifestPath = join(baseDir, contract.baseline.manifest);
assert.ok(existsSync(manifestPath), 'committed baseline manifest missing');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
{
  const nameRe = new RegExp(contract.screenshotNameRegex);
  assert.equal(manifest.format, 'atl3-v01-baseline-capture-v1');
  assert.equal(manifest.contractFormat, contract.format);
  const expectedDesktop = contract.scenes.reduce((s, sc) => s + sc.zoomLevels.length * contract.cameras.length, 0);
  assert.equal(manifest.counts.desktop, expectedDesktop);
  assert.equal(manifest.counts.total, expectedDesktop + contract.scenes.length * (contract.viewports.length - 1));
  for (const c of manifest.captures) {
    assert.match(c.file, nameRe, `baseline name ${c.file}`);
    assert.ok(c.file.includes(`__${manifest.buildSha}__`), `${c.file}: build SHA`);
    assert.ok(existsSync(join(baseDir, c.file)), `baseline PNG missing: ${c.file}`);
    assert.ok(c.metrics.distinctColors >= contract.tolerances.nonBlank.minDistinctColors, `${c.file}: blank`);
  }
  for (const scene of contract.scenes) {
    const s = manifest.storedData.find((d) => d.sceneId === scene.id);
    assert.ok(s && s.fingerprint === scene.dataFingerprint, `${scene.id}: baseline captured from pinned stored data`);
  }
  assert.equal(manifest.sameSceneAcrossCameras, true);
  assert.ok(manifest.repeatCapture.every((r) => r.diffRatio <= contract.tolerances.repeatCapture.maxDiffPixelRatio));
  assert.ok(/software|hardware/.test(manifest.measurementClass), 'measurement class labelled');
  for (const ref of [contract.g04Reference['dornhain-block'], contract.g04Reference.krypta]) {
    assert.ok(existsSync(join(root, ref)), `G04 reference ${ref}`);
    assert.ok(!manifest.captures.some((c) => c.file.includes('g04')), 'G04 shots are not relabelled as V01');
  }
  row('baseline-set', 'PASS', `captures=${manifest.counts.total} sha=${manifest.buildSha} renderer=${manifest.renderer.kind}/${manifest.renderer.preset}`);
}

/* 9) Docs, gates, wiring */
for (const needle of [
  'canonical', 'suggestive', 'atmospheric', 'IV-01', 'IV-02', 'IV-07', 'IV-14', 'IV-18', 'AU-01', 'AU-06',
  'ortho-topdown', 'diorama-oblique', 'perspective', 'Soll/Ist', 'golden-scenes.json', 'Testorakel', 'R01B', 'R05',
  'Software-Rendering', 'Kein Three.js', 'GO/NO-GO',
]) {
  assert.ok(design.includes(needle), `design doc mentions ${needle}`);
}
for (const c of contract.criteria) assert.ok(design.includes(c.id), `design doc lists ${c.id}`);
assert.ok(acceptance.includes('#1295') && acceptance.includes('atl3-v01-visual-contract'));
assert.ok(gate.includes('atl3-v01-visual-contract.self-test.mjs'), 'test-gate wiring');
for (const needle of ['SAGATREE_BROWSER_E2E_HOST', 'data-atlas-ready', '__sagatreeAtlas', "'coords'", "'zoom'", 'featureFingerprint', 'repeatCapture', 'sameSceneAcrossCameras', 'software-rendering']) {
  assert.ok(e2eSrc.includes(needle), `e2e contract: ${needle}`);
}
for (const src of [e2eSrc]) {
  assert.ok(!/\bas any\b|as unknown as|@ts-ignore|@ts-expect-error|@ts-nocheck|eslint-disable/.test(src), 'no type escape hatches');
  assert.ok(!/from ['"]three['"]/.test(src), 'no Three.js in V01');
}
row('docs-gates', 'PASS', 'design + acceptance + e2e + test-gate');

const failed = rows.filter((r) => r.status !== 'PASS');
assert.equal(failed.length, 0);

if (process.env.ATL3_V01_WRITE_EVIDENCE === '1') {
  const facts = contract.__facts;
  const report = {
    format: 'atl3-v01-visual-contract-report-v1',
    issue: 1295,
    rows,
    facts,
    criteria: contract.criteria.map(({ id, scene, area, status }) => ({ id, scene, area, status })),
    statusCount,
    baseline: { buildSha: manifest.buildSha, renderer: manifest.renderer, captures: manifest.counts.total, perf: manifest.perf },
  };
  writeFileSync(join(root, '.qa/runs/atl3-v01-visual-contract.json'), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    '# ATL3-V01 visual contract — self-test report (#1295)',
    '',
    `- Contract: \`${CONTRACT_REL}\``,
    `- Baseline: \`${contract.baseline.dir}\` (build ${manifest.buildSha}, ${manifest.renderer.kind}, preset ${manifest.renderer.preset}, ${manifest.counts.total} captures)`,
    `- Measurement class: ${manifest.measurementClass}`,
    '',
    '| Check | Status | Detail |',
    '|---|---|---|',
    ...rows.map((r) => `| ${r.id} | ${r.status} | ${String(r.detail).replace(/\|/g, '/')} |`),
    '',
    '## Soll/Ist status',
    '',
    '| Criterion | Scene | Area | Status |',
    '|---|---|---|---|',
    ...contract.criteria.map((c) => `| ${c.id} | ${c.scene} | ${c.area} | ${c.status} |`),
    '',
    `Totals: ${Object.entries(statusCount).map(([k, v]) => `${k}=${v}`).join(', ')}. GAP rows are the target for R01B/M01/G01 — not failures of this contract.`,
    '',
  ].join('\n');
  writeFileSync(join(root, '.qa/runs/atl3-v01-visual-contract.md'), md);
  console.log('wrote .qa/runs/atl3-v01-visual-contract.{md,json}');
}

console.log(`atl3-v01-visual-contract self-test: PASS (${rows.length} checks, ${contract.criteria.length} criteria: ${Object.entries(statusCount).map(([k, v]) => `${k}=${v}`).join(' ')})`);

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
const hostSeed = jiti(join(root, 'server/src/bootstrap/dornhain-golden-hierarchy-seed.ts'));

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
const unifiedDoc = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));
/** Fingerprint over the product's canonical persisted form (parse → serialize), so a no-op
 *  re-persist by the product (e.g. default `angle: 0`) is not data drift; real edits still are. */
function featureFingerprint(rawDoc) {
  const parsed = unifiedDoc.parseUnifiedCanvasDoc(rawDoc);
  assert.ok(parsed, 'stored unifiedCanvas parses as a product doc');
  const doc = unifiedDoc.serializeUnifiedCanvasDoc(parsed);
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

/* 2b) Host seed = FE Golden builder (ensure-starter stores exactly the contract data) */
for (const scene of contract.scenes) {
  const host = hostSeed.DORHAIN_GOLDEN_MAP_SEEDS.find((m) => m.seedKey === scene.mapSeedKey);
  assert.ok(host, `${scene.id}: Host seed exists`);
  assert.equal(featureFingerprint(host.buildCanvas()), scene.dataFingerprint, `${scene.id}: Host seed data = contract fingerprint`);
  const fe = golden.DORNHAIN_GOLDEN_MAPS.find((m) => m.seedKey === scene.mapSeedKey);
  const feMeta = golden.buildDornhainGoldenChildGeneratorMeta(fe, 'parent');
  const hostMeta = hostSeed.buildGoldenChildGeneratorMeta(host, 'parent');
  assert.deepEqual(hostMeta.dungeon ?? null, feMeta.dungeon ?? null, `${scene.id}: Host generatorMeta.dungeon = FE`);
}
row('host-seed-parity', 'PASS', contract.scenes.map((s) => `${s.id}=${s.dataFingerprint}`).join(' '));

/* 2c) Dornhain terrain (decision 1): canonical heightfield, relief > 0, never under canonical features */
{
  const t = contract.scenes[0].terrain;
  const hf = docs['dornhain-block'].heightfield;
  assert.ok(hf, 'Dornhain Golden carries a heightfield');
  assert.deepEqual([hf.cols, hf.rows, hf.cellSize, hf.originX, hf.originZ, hf.waterLevel], [t.cols, t.rows, t.cellSize, t.origin[0], t.origin[1], t.waterLevel]);
  assert.deepEqual(golden.GOLDEN_DORNHAIN_HILLS.map((h) => ({ ...h })), t.hills, 'hills pinned in contract');
  const at = (x, z) => {
    const c = (x - hf.originX) / hf.cellSize;
    const r = (z - hf.originZ) / hf.cellSize;
    const c0 = Math.max(0, Math.min(hf.cols - 2, Math.floor(c)));
    const r0 = Math.max(0, Math.min(hf.rows - 2, Math.floor(r)));
    const fx = Math.min(1, Math.max(0, c - c0));
    const fz = Math.min(1, Math.max(0, r - r0));
    const H = (cc, rr) => hf.heights[rr * hf.cols + cc];
    return H(c0, r0) * (1 - fx) * (1 - fz) + H(c0 + 1, r0) * fx * (1 - fz) + H(c0, r0 + 1) * (1 - fx) * fz + H(c0 + 1, r0 + 1) * fx * fz;
  };
  const doc = docs['dornhain-block'];
  let worst = -Infinity;
  for (const r of doc.rooms.filter((r) => r.id !== 'g.ocean')) {
    for (let x = r.x; x <= r.x + r.w; x += 5) for (let z = r.y; z <= r.y + r.h; z += 5) worst = Math.max(worst, at(x, z));
  }
  for (const o of doc.objects) for (const [dx, dz] of [[0, 0], [24, 0], [-24, 0], [0, 24], [0, -24]]) worst = Math.max(worst, at(o.x + dx, o.y + dz));
  for (const st of doc.strokes) for (const [x, z] of st.points) worst = Math.max(worst, at(x, z));
  assert.ok(worst <= -0.6, `terrain buries canonical features (max ${worst})`);
  const peak = Math.max(...hf.heights);
  assert.ok(peak >= 10, 'relief rises above the map sheet');
  row('golden-terrain', 'PASS', `hills=${t.hills.length} peak=${peak} underFeaturesMax=${worst.toFixed(2)}`);
}

/* 2d) Krypta = committed Dungeon-Forge crypt (decisions 1 + 4): closed rooms, doors, theme torch */
{
  const f = contract.scenes[1].forge;
  const p = golden.GOLDEN_KRYPTA_FORGE_PARAMS;
  assert.deepEqual(
    [p.seed, p.roomCount, p.loopChance, p.themeKey, p.originX, p.originY, p.unitScale],
    [f.seed, f.roomCount, f.loopChance, f.themeKey, f.origin[0], f.origin[1], f.unitScale],
    'forge params pinned in contract',
  );
  const meta = golden.buildGoldenCryptDungeonMeta();
  assert.equal(meta.generatorVersion, f.generatorVersion);
  assert.equal(meta.confirmed, true, 'committed (confirmed) forge run');
  assert.equal(meta.themeKey, contract.scenes[1].dungeonThemeKey);
  const doc = docs.krypta;
  assert.ok(doc.rooms.length >= 4 && doc.rooms.every((r) => dungeon.isAtlasDungeonFeatureId(r.id)), 'forge rooms');
  assert.ok((doc.doors ?? []).length > 0, 'forge doors');
  const wallIds = new Set(doc.walls.map((w) => w.id));
  assert.ok(doc.doors.every((d) => wallIds.has(d.wallId)), 'every door sits on a stored wall');
  // Room closure: every room edge is covered by wall segments (rasterised forge walls run along the cell grid).
  const onEdge = (r, x, z) => doc.walls.some((w) => {
    const minX = Math.min(w.x1, w.x2) - 1e-6, maxX = Math.max(w.x1, w.x2) + 1e-6;
    const minZ = Math.min(w.y1, w.y2) - 1e-6, maxZ = Math.max(w.y1, w.y2) + 1e-6;
    const tol = r.w / 4;
    return x >= minX - tol && x <= maxX + tol && z >= minZ - tol && z <= maxZ + tol;
  });
  let open = 0;
  for (const r of doc.rooms) {
    for (const [x, z] of [[r.x + r.w / 2, r.y], [r.x + r.w / 2, r.y + r.h], [r.x, r.y + r.h / 2], [r.x + r.w, r.y + r.h / 2]]) {
      if (!onEdge(r, x, z)) open += 1;
    }
  }
  assert.equal(open, 0, `Krypta rooms have open sides (${open})`);
  row('golden-forge-krypta', 'PASS', `seed=${p.seed} rooms=${doc.rooms.length} walls=${doc.walls.length} doors=${doc.doors.length} objects=${doc.objects.length}`);
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
  const kLite = dungeon.buildAtlasDungeonLookPlan(krypta, { themeKey: contract.scenes[1].dungeonThemeKey, graphicsPresetId: 'lite' });
  const facts = {
    dornhainRoofTokens: roofTokens,
    dornhainTreeVariants: treeVariants,
    dornhainHeightfield: docs['dornhain-block'].heightfield ? 'present' : 'none',
    dornhainHeightMax: docs['dornhain-block'].heightfield ? Math.max(...docs['dornhain-block'].heightfield.heights) : 0,
    kryptaRooms: krypta.rooms.length,
    kryptaWalls: krypta.walls.length,
    kryptaDoors: (krypta.doors ?? []).length,
    kryptaDungeonLookTorches: kPlan.counts.torches,
    kryptaDungeonLookInstances: kPlan.counts.instances,
    kryptaDungeonLookTruncatedLite: kLite.counts.truncated,
  };
  const runtimeSrc = read('src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs');
  facts.runtimeShadowPass = /createFramebuffer|shadowMap|depthTexture/i.test(runtimeSrc);
  facts.runtimeLocalLightFalloff = /pointLight|lightFalloff|uTorch|torchLight/i.test(runtimeSrc);
  facts.runtimeDepthBias = /polygonOffset|POLYGON_OFFSET/.test(runtimeSrc);
  facts.kryptaCorridorStubWalls = krypta.walls.filter((w) => w.id.startsWith('dcorr-')).length;
  facts.dioramaDoors = plan.batches.filter((b) => /door/i.test(b.kind ?? '')).length;
  contract.__facts = facts;
  assert.equal(facts.kryptaDungeonLookTruncatedLite, 0, 'Golden Krypta fits the lite instance budget (no dropped canonical features)');
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
  assert.equal(contract.referenceDevices.status, 'binding', 'reference devices confirmed (Ben 2026-11-15)');
  for (const b of contract.hardwareBudgets) {
    assert.ok(Array.isArray(b.referenceDevices) && b.referenceDevices.length >= 1, `${b.tier}: named reference devices`);
  }
  const ib = contract.instanceBudgets;
  const t = perf.ATLAS_PERF_BUDGET_THRESHOLDS;
  assert.deepEqual([ib.high, ib.balanced, ib.lite], [t.maxInstancesHigh, t.maxInstancesBalanced, t.maxInstancesLite]);
  assert.equal(contract.ciSoftwareCeiling.renderer, 'software-webgl');
  row('budgets', 'PASS', `tiers=${tiers.join(',')} ciCeiling=${contract.ciSoftwareCeiling.frameP95Ms}ms (software only)`);
}

/* 7b) Product quality switch (decision 2): default, strict parse, wired into the 3D editor */
{
  assert.equal(target.ATLAS_GRAPHICS_PRESET_DEFAULT, contract.qualitySwitch.default);
  assert.equal(target.parseAtlasGraphicsPresetId('high'), 'high');
  assert.equal(target.parseAtlasGraphicsPresetId('ultra'), null);
  assert.equal(target.parseAtlasGraphicsPresetId(null), null);
  assert.deepEqual(contract.qualityProfiles.map((q) => q.id), target.ATLAS_GRAPHICS_PRESETS.map((p) => p.id));
  assert.ok(contract.qualityProfiles.every((q) => q.captured === true), 'all profiles captured');
  assert.equal(contract.qualityProfiles.filter((q) => q.default).map((q) => q.id).join(), contract.qualitySwitch.default);
  const editorSrc = read('src/app/world/atlas/unified/UnifiedAtlasEditor.tsx');
  const hookSrc = read('src/app/world/atlas/unified/useAtlasGraphicsPreset.ts');
  assert.ok(editorSrc.includes('data-atlas-graphics-preset-select'), 'switch rendered in the 3D editor');
  assert.ok(editorSrc.includes('graphicsPresetId={graphicsPresetId}'), 'switch drives AtlasNative3dEditor');
  assert.ok(hookSrc.includes('ATLAS_GRAPHICS_PRESET_STORAGE_KEY') && hookSrc.includes('parseAtlasGraphicsPresetId'), 'persisted + parsed');
  const runtimeSrc = read('src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs');
  assert.ok(!/__v01|atl3-v01|testHook/i.test(runtimeSrc), 'no V01 test hooks in the runtime');
  const profiles = new Set(contract.profileMatrix.map((r) => r.profile));
  for (const id of ['high', 'balanced', 'lite']) assert.ok(profiles.has(id), `profile matrix covers ${id}`);
  row('quality-switch', 'PASS', `default=${target.ATLAS_GRAPHICS_PRESET_DEFAULT} rows=${contract.profileMatrix.length}`);
}

/* 8) Committed Custom-WebGL baseline set (Ist evidence) */
const baseDir = join(root, contract.baseline.dir);
const manifestPath = join(baseDir, contract.baseline.manifest);
assert.ok(existsSync(manifestPath), 'committed baseline manifest missing');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
{
  const nameRe = new RegExp(contract.screenshotNameRegex);
  assert.equal(manifest.format, 'atl3-v01-baseline-capture-v2');
  assert.equal(manifest.contractFormat, contract.format);
  const expectedDesktop = contract.scenes.reduce((s, sc) => s + sc.zoomLevels.length * contract.cameras.length, 0);
  assert.equal(manifest.counts.desktop, expectedDesktop);
  const zoomsFor = (scene, r) => (r.zoomIds === 'all' ? scene.zoomLevels : scene.zoomLevels.filter((z) => r.zoomIds.some((p) => z.id.startsWith(`${p}-`))));
  const expectedTotal = contract.profileMatrix.reduce(
    (n, r) => n + contract.scenes.reduce((m, sc) => m + zoomsFor(sc, r).length * r.cameras.length, 0),
    0,
  );
  assert.equal(manifest.counts.total, expectedTotal);
  for (const id of ['high', 'balanced', 'lite']) assert.ok(manifest.counts.byProfile[id] > 0, `baseline has ${id} captures`);
  assert.equal(manifest.qualitySwitch.default, contract.qualitySwitch.default, 'browser saw the product default');
  for (const c of manifest.captures) assert.ok(c.file.includes(`__${c.profile}-`), `${c.file}: profile in name`);
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
  row('baseline-set', 'PASS', `captures=${manifest.counts.total} sha=${manifest.buildSha} renderers=${Object.entries(manifest.renderers).map(([k, v]) => `${k}:${v.kind}`).join(',')}`);
}

/* 8b) Stale-matrix guard (Codex P2 on PR #1302): every status must agree with measured evidence, both ways.
 *  - Evidence rules: a row may not stay GAP/PARTIAL/NOT_RUN once the domain/runtime/capture evidence shows the
 *    improvement, and may not claim MET while the evidence still shows the gap.
 *  - Visual-only rows are bound to the exact baseline pixels they were judged on (matrixEvaluation.baselineDigest);
 *    a re-captured baseline fails here until the matrix is re-evaluated and the digest re-pinned. The browser
 *    capture fails on drift against the committed baseline (manifest.baselineDrift), so a renderer change cannot
 *    pass CI with a stale matrix. */
{
  const f = contract.__facts;
  const st = (id) => {
    const c = contract.criteria.find((x) => x.id === id);
    assert.ok(c, `criterion ${id} exists`);
    return c.status;
  };
  const caps = manifest.captures;
  const tol = contract.tolerances;
  const okRepeat = manifest.repeatCapture.length > 0 && manifest.repeatCapture.every((r) => r.diffRatio <= tol.repeatCapture.maxDiffPixelRatio);
  const okDevices = manifest.devices.length > 0 && manifest.devices.every((d) => d.canvas.w >= 200 && d.overflowX <= 1);
  const okCamera = caps.every((c) => c.actual && Math.abs(c.actual.x - c.target.x) <= tol.cameraCenterUnits && Math.abs(c.actual.z - c.target.z) <= tol.cameraCenterUnits);
  const okData = manifest.storedData.every((d) => contract.scenes.find((sc) => sc.id === d.sceneId)?.dataFingerprint === d.fingerprint);
  const allProfiles = ['high', 'balanced', 'lite'].every((p) => (manifest.counts.byProfile?.[p] ?? 0) > 0);
  const hardware = /^hardware/.test(manifest.measurementClass ?? '');
  const playerCaptured = caps.some((c) => c.role === 'player');
  /** id → allowed statuses derived from evidence (exact where the evidence is binary). */
  const allowedBy = {
    'D-GEO-01': f.dornhainRoofTokens < 3 ? ['GAP'] : ['PARTIAL', 'MET'],
    'D-GEO-02': f.dornhainTreeVariants < 3 ? ['GAP'] : ['PARTIAL', 'MET'],
    'D-GEO-03': f.dornhainHeightfield === 'none' || f.dornhainHeightMax <= 0 ? ['GAP'] : ['PARTIAL', 'MET'],
    'D-SHD-01': f.runtimeShadowPass ? ['PARTIAL', 'MET'] : ['GAP'],
    'K-SHD-01': f.runtimeShadowPass ? ['PARTIAL', 'MET'] : ['GAP'],
    'K-GEO-01': f.kryptaDoors === 0 ? ['GAP'] : f.kryptaCorridorStubWalls > 0 ? ['PARTIAL'] : ['PARTIAL', 'MET'],
    'K-LIT-01': f.kryptaDungeonLookTorches === 0 ? ['GAP'] : f.runtimeLocalLightFalloff ? ['PARTIAL', 'MET'] : ['PARTIAL'],
    'D-ART-01': f.runtimeDepthBias ? ['GAP', 'PARTIAL', 'MET'] : ['GAP', 'PARTIAL'],
    'K-ART-01': f.runtimeDepthBias ? ['GAP', 'PARTIAL', 'MET'] : ['GAP', 'PARTIAL'],
    'C-CAM-01': manifest.sameSceneAcrossCameras ? ['MET'] : ['GAP'],
    'C-DET-01': okRepeat ? ['MET'] : ['GAP'],
    'C-CAM-02': okCamera ? ['MET'] : ['GAP'],
    'C-DATA-01': okData ? ['MET'] : ['GAP'],
    'C-AU-01': okDevices ? ['MET'] : ['GAP'],
    'C-PROF-01': allProfiles ? ['PARTIAL', 'MET'] : ['NOT_RUN'],
    'C-PERF-01': hardware ? ['GAP', 'PARTIAL', 'MET'] : ['NOT_RUN'],
    'C-SEC-01': playerCaptured ? ['GAP', 'PARTIAL', 'MET'] : ['NOT_RUN'],
    'C-AUTH-01': ['MET'],
  };
  const stale = [];
  for (const [id, allowed] of Object.entries(allowedBy)) {
    if (!allowed.includes(st(id))) stale.push(`${id}=${st(id)} (evidence allows ${allowed.join('/')})`);
  }
  assert.deepEqual(stale, [], `Soll/Ist matrix is stale against evidence: ${stale.join('; ')}`);

  // Visual-only rows: pinned to the baseline pixels they were judged on.
  const visualOnly = contract.criteria.filter((c) => !(c.id in allowedBy)).map((c) => c.id);
  const me = contract.matrixEvaluation;
  assert.ok(me && typeof me.baselineDigest === 'string', 'matrixEvaluation.baselineDigest pinned');
  assert.deepEqual([...me.visualOnlyCriteria].sort(), [...visualOnly].sort(), 'matrixEvaluation lists every visual-only criterion');
  const digest = createHash('sha256');
  const norm = (file) => file.split('__').filter((_, i) => i !== 2 && i !== 5).join('__');
  for (const c of [...caps].sort((x, y) => norm(x.file).localeCompare(norm(y.file)))) {
    digest.update(`${norm(c.file)}:${createHash('sha256').update(readFileSync(join(baseDir, c.file))).digest('hex')}\n`);
  }
  const baselineDigest = digest.digest('hex').slice(0, 16);
  assert.equal(
    baselineDigest,
    me.baselineDigest,
    `baseline re-captured (${baselineDigest}) but matrix still evaluated against ${me.baselineDigest}: re-evaluate ${visualOnly.join(', ')} and re-pin matrixEvaluation`,
  );
  assert.deepEqual(manifest.baselineDrift ?? [], [], 'committed baseline has no drift entries');
  row('matrix-not-stale', 'PASS', `evidence-rules=${Object.keys(allowedBy).length} visual-only=${visualOnly.length} digest=${baselineDigest}`);
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
for (const needle of ['SAGATREE_BROWSER_E2E_HOST', 'data-atlas-ready', '__sagatreeAtlas', "'coords'", "'zoom'", 'featureFingerprint', 'repeatCapture', 'sameSceneAcrossCameras', 'software-rendering', 'data-atlas-graphics-preset-select', 'profileMatrix']) {
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
    `- Baseline: \`${contract.baseline.dir}\` (build ${manifest.buildSha}, ${Object.entries(manifest.renderers).map(([k, v]) => `${k}=${v.kind}`).join(', ')}, ${manifest.counts.total} captures)`,
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

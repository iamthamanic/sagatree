#!/usr/bin/env node
/**
 * ATL3-V01 round 3 — visual fixes guard (#1295 / PR #1302).
 * Location: scripts/atl3-v01-round3-visual-fixes.self-test.mjs
 *
 * Locks Ben's five round-3 points:
 *  1. existing worlds: untouched pre-V01 Golden crypt / Dornhain-without-heightfield are upgraded
 *     idempotently on ensure; user-edited canvases are never touched;
 *  2. Dungeon-Forge prop sizes keep a real-world size independent of the unit scale;
 *  3. corridors are floor rects (dcorr-*) bounded by edge walls — no centerline wall bars;
 *  4. torch light has a distance falloff per quality preset (WebGL per-pixel, lite per-face);
 *  5. lite painter's algorithm: bbox cull, split of large faces, ground pass before standing geometry.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const atlas = jiti(join(root, 'src/domains/world/atlas/index.ts'));

// ── 2) Prop real-world size independent of the unit scale ───────────────────────────────────────
for (const kind of ['lampe', 'kiste']) {
  const cells = atlas.DUNGEON_PROP_REAL_SIZE[kind].cells;
  for (const unit of [1, 1.1, 6, 18, 40]) {
    const size = atlas.dungeonPropStampSize(kind, unit);
    assert.ok(size > 0, `${kind}@${unit} size > 0`);
    assert.ok(Math.abs(atlas.dungeonPropRealSizeCells(kind, size, unit) - cells) < 1e-3, `${kind}@${unit} keeps ${cells} cells`);
  }
  // Same cell grid at two unit scales → same size relative to a cell (no unit-scale drift).
  const a = atlas.dungeonPropStampSize(kind, 9) / 9;
  const b = atlas.dungeonPropStampSize(kind, 27) / 27;
  assert.ok(Math.abs(a - b) < 1e-4, `${kind}: size/cell constant across unit scales`);
}
for (const unitScale of [12, 18, 30]) {
  const gen = atlas.generateDungeon(atlas.normalizeDungeonGenerateParams({ seed: 4242, roomCount: 6, unitScale }));
  const objs = gen.canvasObjects;
  const lamp = objs.find((o) => o.type === 'lampe');
  if (lamp) {
    assert.ok(Math.abs(atlas.dungeonPropRealSizeCells('lampe', lamp.size, unitScale) - 1.2) < 1e-3, `forge lamp real size @${unitScale}`);
    assert.equal(lamp.height, undefined, 'no unit-scaled height on forge props');
  }
}

// ── 3) Corridors are floors along edges, not wall bars through rooms ───────────────────────────
{
  const krypta = await import(pathToFileURL(join(root, 'server/src/bootstrap/dornhain-golden-krypta-forge.ts')).href);
  const canvas = krypta.GOLDEN_KRYPTA_FORGE_FEATURES;
  assert.ok(canvas && Array.isArray(canvas.rooms), 'golden Krypta canvas exported');
  const corridors = canvas.rooms.filter((r) => r.id.startsWith('dcorr-'));
  const rooms = canvas.rooms.filter((r) => r.id.startsWith('droom-'));
  assert.ok(corridors.length > 0, 'corridor floor rects present');
  assert.equal(canvas.walls.filter((w) => w.id.startsWith('dcorr')).length, 0, 'no corridor centerline walls');
  const overlap = (p, q) => Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x) > 1e-6 && Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y) > 1e-6;
  const touch = (p, q) => Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x) >= -1e-6 && Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y) >= -1e-6;
  for (const c of corridors) {
    for (const r of rooms) assert.ok(!overlap(c, r), `${c.id} does not overlap ${r.id} (no z-fighting)`);
    assert.ok([...rooms, ...corridors].some((o) => o !== c && touch(c, o)), `${c.id} abuts the floor network`);
  }
  // No wall segment crosses the interior of a room floor (bars through rooms).
  for (const w of canvas.walls) {
    const mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
    for (const r of rooms) {
      const inside = mx > r.x + 1 && mx < r.x + r.w - 1 && my > r.y + 1 && my < r.y + r.h - 1;
      assert.ok(!inside, `wall ${w.id} midpoint not inside ${r.id}`);
    }
  }
}

// ── 4) Torch falloff per quality preset ────────────────────────────────────────────────────────
{
  const T = atlas.ATLAS_DUNGEON_TORCH_LIGHT;
  for (const preset of ['lite', 'balanced', 'high']) {
    const cfg = T[preset];
    assert.ok(cfg && cfg.radiusCells > 0 && cfg.maxLights > 0, `${preset} torch config`);
    const f = (d) => atlas.atlasDungeonTorchAttenuation(d, cfg.radiusCells, cfg.falloff);
    assert.equal(f(0), 1, `${preset}: full at the flame`);
    assert.ok(f(cfg.radiusCells * 0.5) < 1 && f(cfg.radiusCells * 0.5) > 0, `${preset}: partial mid-radius`);
    assert.equal(f(cfg.radiusCells), 0, `${preset}: zero at radius`);
    assert.equal(f(cfg.radiusCells * 2), 0, `${preset}: zero beyond radius`);
    for (let d = 0; d < cfg.radiusCells; d += 0.25) assert.ok(f(d) >= f(d + 0.25), `${preset}: monotonic`);
  }
  assert.ok(T.high.maxLights >= T.balanced.maxLights && T.balanced.maxLights >= T.lite.maxLights, 'lights scale with preset');
  assert.equal(T.lite.falloff, 'linear-per-face');
  assert.equal(T.high.falloff, 'smooth-quadratic-per-pixel');
  for (const preset of ['lite', 'balanced', 'high']) {
    const p = atlas.resolveAtlasDungeonLightProfile('ancient', preset);
    assert.equal(p.torchRadiusCells, T[preset].radiusCells, `${preset} light profile carries radius`);
    assert.equal(p.maxTorchLights, T[preset].maxLights, `${preset} light profile carries light count`);
  }
  const rt = read('src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs');
  assert.ok(/uniform vec4 uTorch\[8\]/.test(rt) && /torchLight\+=/.test(rt), 'WebGL per-pixel torch loop');
  assert.ok(/function productTorchLights\(/.test(rt), 'torch light extraction');
  assert.ok(/productTorchLights\(Math\.min\(2,/.test(rt), 'lite: ≤ 2 per-face torch lights');
  const look = read('src/app/world/atlas/unified/atlas-native-3d-look.ts');
  assert.ok(look.includes('torchRadiusCells') && look.includes('maxTorchLights'), 'look → runtime wiring');
}

// ── 5) Lite depth ordering ─────────────────────────────────────────────────────────────────────
{
  const rt = read('src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs');
  assert.ok(/LITE_GROUND_Y=0\.05/.test(rt), 'ground layer threshold');
  assert.ok(/ground\.sort\(\(p,q\)=>\(p\[1\]-q\[1\]\)\|\|\(p\[0\]-q\[0\]\)\)/.test(rt), 'ground pass sorted by height then depth');
  assert.ok(/ground\.concat\(rest\)/.test(rt), 'ground drawn before standing geometry');
  assert.ok(/maxX<0\|\|minX>w\|\|maxY<0\|\|minY>h/.test(rt), 'bbox cull (no centroid cull)');
  assert.ok(/edge>maxEdge&&level<maxLevel/.test(rt), 'large faces split');
  assert.ok(/persp\?-Math\.hypot\(cx-eye\[0\]/.test(rt), 'perspective: eye-distance key');
}

// ── 1) Golden content upgrade for existing worlds ──────────────────────────────────────────────
{
  const up = await import(pathToFileURL(join(root, 'server/src/bootstrap/dornhain-golden-content-upgrade.ts')).href);
  const seed = await import(pathToFileURL(join(root, 'server/src/bootstrap/dornhain-golden-hierarchy-seed.ts')).href);
  const doc = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));
  const spec = (k) => seed.DORHAIN_GOLDEN_MAP_SEEDS.find((m) => m.seedKey === k);
  const current = (k) => seed.buildGoldenChildGeneratorMeta(spec(k), 'p').unifiedCanvas;
  // Editor re-persist (parse → serialize) of a stored canvas: adds layers/angle/doors defaults.
  const productForm = (c) => {
    const parsed = doc.parseUnifiedCanvasDoc({ format: doc.UNIFIED_CANVAS_FORMAT, doors: [], ...c });
    assert.ok(parsed, 'canvas parses in the product');
    return JSON.parse(JSON.stringify(doc.serializeUnifiedCanvasDoc(parsed)));
  };
  const CRYPT = 'dornhain.map.loc.crypt', TOWN = 'dornhain.map.place.dornhain';
  const v1 = JSON.parse(JSON.stringify(up.DORNHAIN_GOLDEN_CRYPT_V1_CANVAS));
  const { heightfield: _hf, ...townFlat } = current(TOWN);
  assert.ok(up.isUntouchedLegacyGoldenCanvas(CRYPT, v1, current(CRYPT)), 'v1 crypt is legacy');
  assert.ok(up.isUntouchedLegacyGoldenCanvas(CRYPT, productForm(v1), current(CRYPT)), 'v1 crypt (editor re-persist) is legacy');
  assert.ok(up.isUntouchedLegacyGoldenCanvas(TOWN, townFlat, current(TOWN)), 'Dornhain w/o heightfield is legacy');
  assert.ok(up.isUntouchedLegacyGoldenCanvas(TOWN, productForm(townFlat), current(TOWN)), 'Dornhain w/o hf (re-persist) is legacy');
  assert.ok(!up.isUntouchedLegacyGoldenCanvas(CRYPT, current(CRYPT), current(CRYPT)), 'current crypt is not re-upgraded');
  assert.ok(!up.isUntouchedLegacyGoldenCanvas(TOWN, productForm(current(TOWN)), current(TOWN)), 'current Dornhain (re-persist) idempotent');
  const edited = JSON.parse(JSON.stringify(v1));
  edited.objects[0].x += 12;
  assert.ok(!up.isUntouchedLegacyGoldenCanvas(CRYPT, edited, current(CRYPT)), 'moved prop = user edit');
  const added = { ...townFlat, rooms: [...townFlat.rooms, { id: 'u1', x: 1, y: 1, w: 10, h: 10, material: 'holz' }] };
  assert.ok(!up.isUntouchedLegacyGoldenCanvas(TOWN, added, current(TOWN)), 'added room = user edit');
  assert.ok(!up.isUntouchedLegacyGoldenCanvas('dornhain.map.loc.tavern', v1, current('dornhain.map.loc.tavern')), 'wrong seed key never matches');

  const { bootstrapHostPersistence } = await import(pathToFileURL(join(root, 'server/src/persistence/index.ts')).href);
  const { ensureDornhainDefaultCatalog } = await import(pathToFileURL(join(root, 'server/src/bootstrap/ensure-dornhain-default.ts')).href);
  const work = mkdtempSync(join(tmpdir(), 'atl3-v01-r3-'));
  mkdirSync(join(work, 'data'));
  try {
    const boot = bootstrapHostPersistence({ dataDir: join(work, 'data'), migrationsDir: join(root, 'server/migrations') });
    assert.equal(boot.ok, true, 'host bootstrap');
    const db = boot.db;
    const owner = `solo-atl3-v01-r3-${randomUUID().slice(0, 8)}`;
    const first = ensureDornhainDefaultCatalog(db, owner);
    const rows = () => {
      const m = new Map();
      for (const r of db.prepare('SELECT id, title, generator_meta, revision FROM world_atlas_maps WHERE world_profile_id = ?').all(first.worldId)) {
        const meta = JSON.parse(r.generator_meta);
        if (typeof meta.seed === 'string') m.set(meta.seed, { ...r, meta });
      }
      return m;
    };
    const sig = (c) => up.goldenCanvasContentSignature(c);
    const fresh = rows();
    assert.equal(sig(fresh.get(CRYPT).meta.unifiedCanvas), sig(current(CRYPT)), 'fresh world: forge crypt');
    assert.ok(fresh.get(TOWN).meta.unifiedCanvas.heightfield, 'fresh world: Dornhain heightfield');
    const setCanvas = (row, canvas, extra = {}) =>
      db.prepare('UPDATE world_atlas_maps SET generator_meta = ? WHERE id = ?').run(
        JSON.stringify({ ...row.meta, ...extra, unifiedCanvas: canvas }),
        row.id,
      );
    // Simulate a pre-V01 world: old crypt (product re-persist form, no forge meta) + flat Dornhain.
    const { dungeon: _d, ...cryptMetaNoForge } = fresh.get(CRYPT).meta;
    db.prepare('UPDATE world_atlas_maps SET generator_meta = ? WHERE id = ?').run(
      JSON.stringify({ ...cryptMetaNoForge, unifiedCanvas: productForm(v1) }),
      fresh.get(CRYPT).id,
    );
    setCanvas(fresh.get(TOWN), townFlat);
    // A user-edited Golden map (tavern) must stay byte-identical.
    const tavern = fresh.get('dornhain.map.loc.tavern');
    const tavernCanvas = { ...tavern.meta.unifiedCanvas, rooms: [...(tavern.meta.unifiedCanvas.rooms ?? []), { id: 'user-room', x: 5, y: 5, w: 40, h: 40, material: 'holz' }] };
    setCanvas(tavern, tavernCanvas);
    const before = rows();
    ensureDornhainDefaultCatalog(db, owner);
    const upgraded = rows();
    assert.equal(sig(upgraded.get(CRYPT).meta.unifiedCanvas), sig(current(CRYPT)), 'old crypt upgraded to forge crypt');
    assert.ok(upgraded.get(CRYPT).meta.dungeon, 'forge dungeon meta restored');
    assert.equal(upgraded.get(CRYPT).revision, before.get(CRYPT).revision + 1, 'crypt revision bumped');
    assert.ok(upgraded.get(TOWN).meta.unifiedCanvas.heightfield, 'Dornhain gains the heightfield');
    assert.equal(upgraded.get(TOWN).revision, before.get(TOWN).revision + 1, 'Dornhain revision bumped');
    assert.equal(upgraded.get('dornhain.map.loc.tavern').generator_meta, before.get('dornhain.map.loc.tavern').generator_meta, 'user-edited map untouched');
    assert.equal(upgraded.get('dornhain.map.loc.tavern').revision, before.get('dornhain.map.loc.tavern').revision, 'user-edited revision unchanged');
    ensureDornhainDefaultCatalog(db, owner);
    const again = rows();
    for (const [k, r] of upgraded) {
      assert.equal(again.get(k).generator_meta, r.generator_meta, `${k}: idempotent`);
      assert.equal(again.get(k).revision, r.revision, `${k}: no revision churn`);
    }
    // User-edited legacy crypt (moved relic) is never upgraded.
    setCanvas(again.get(CRYPT), edited);
    const editedBefore = rows().get(CRYPT);
    ensureDornhainDefaultCatalog(db, owner);
    assert.equal(rows().get(CRYPT).generator_meta, editedBefore.generator_meta, 'edited legacy crypt untouched');
    db.close();
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

console.log('atl3-v01-round3-visual-fixes.self-test: OK');

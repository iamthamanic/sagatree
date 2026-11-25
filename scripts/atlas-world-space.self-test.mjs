#!/usr/bin/env node
/**
 * atlas-world-space.self-test — SWS-01 recursive World-Space transforms + guards.
 *
 * Verifies (ADR-SWS-01 §3):
 *  - localToWorld composes the full anchor chain (n Ebenen).
 *  - worldToLocal is the exact inverse (roundtrip < 1e-9).
 *  - Cycle detection is fail-closed (read guard).
 *  - Shear rule: rotated + non-uniform anchor is rejected.
 *  - Unlocated / missing-parent produce honest errors (no invented geography).
 *  - Depth reporting matches chain length.
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'atlas-world-space-'));
const outfile = join(tmp, 'ws.mjs');

buildSync({
  entryPoints: [join(root, 'src/domains/world/atlas/atlas-world-space.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
});

const ws = await import(pathToFileURL(outfile).href);

const B = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
function anchor(parentMapId, centerX, centerY, extentX, extentY, rotationRad = 0) {
  return { parentMapId, centerX, centerY, extentX, extentY, rotationRad, metersPerUnit: null };
}

// Golden-ähnliche Kette: Welt → Kontinent → Land → Ort → Taverne
const nodes = {
  welt: { id: 'welt', parentAnchor: null, bounds: B },
  kontinent: { id: 'kontinent', parentAnchor: anchor('welt', 260, 420, 160, 220), bounds: B },
  land: { id: 'land', parentAnchor: anchor('kontinent', 430, 400, 110, 100), bounds: B },
  ort: { id: 'ort', parentAnchor: anchor('land', 360, 510, 55, 55), bounds: B },
  taverne: { id: 'taverne', parentAnchor: anchor('ort', 328, 528, 24, 24), bounds: B },
};

// 1) Ein-Ebenen-Bekanntwert: Tisch (360,360) in Taverne → Ort = (321.28, 521.28)
const oneStep = ws.localToWorld(nodes, 'taverne', { x: 360, y: 360 });
assert.equal(oneStep.ok, true);
// chain taverne→ort→land→kontinent→welt, aber 1. Sprung = Ort-Koordinate
// Rekonstruiere den Ort-Sprung isoliert:
const directOrt = ws.localToWorld({ taverne: nodes.taverne, ort: { id: 'ort', parentAnchor: null, bounds: B } }, 'taverne', { x: 360, y: 360 });
assert.ok(Math.abs(directOrt.value.x - 321.28) < 1e-9, `Ort x: ${directOrt.value.x}`);
assert.ok(Math.abs(directOrt.value.y - 521.28) < 1e-9, `Ort y: ${directOrt.value.y}`);

// 2) Volle Komposition bis Welt ist endlich und deterministisch
const w1 = ws.localToWorld(nodes, 'taverne', { x: 360, y: 360 });
const w2 = ws.localToWorld(nodes, 'taverne', { x: 360, y: 360 });
assert.equal(w1.ok, true);
assert.equal(w1.depth, 5, 'Kette taverne..welt = 5 Knoten');
assert.deepEqual(w1.value, w2.value, 'deterministisch');
assert.ok(Number.isFinite(w1.value.x) && Number.isFinite(w1.value.y));

// 3) Roundtrip über n Ebenen ist exakt
const back = ws.worldToLocal(nodes, 'taverne', w1.value);
assert.equal(back.ok, true);
assert.ok(Math.abs(back.value.x - 360) < 1e-9, `roundtrip x: ${back.value.x}`);
assert.ok(Math.abs(back.value.y - 360) < 1e-9, `roundtrip y: ${back.value.y}`);

// 4) Wurzel: localToWorld == identity, depth 1
const rootRes = ws.localToWorld(nodes, 'welt', { x: 12, y: 34 });
assert.equal(rootRes.ok, true);
assert.equal(rootRes.depth, 1);
assert.deepEqual(rootRes.value, { x: 12, y: 34 });

// 5) Zyklus: A→B→A ist fail-closed
const cyc = {
  a: { id: 'a', parentAnchor: anchor('b', 500, 500, 10, 10), bounds: B },
  b: { id: 'b', parentAnchor: anchor('a', 500, 500, 10, 10), bounds: B },
};
const cycRes = ws.localToWorld(cyc, 'a', { x: 1, y: 1 });
assert.equal(cycRes.ok, false);
assert.equal(cycRes.error, 'cycle');

// 6) Fehlende Parent-Map → missing-node
const orphan = { x: { id: 'x', parentAnchor: anchor('ghost', 1, 1, 5, 5), bounds: B } };
const orphanRes = ws.localToWorld(orphan, 'x', { x: 1, y: 1 });
assert.equal(orphanRes.ok, false);
assert.equal(orphanRes.error, 'missing-node');

// 7) Shear: rotiert + nicht-uniform → reject
const shear = {
  root: { id: 'root', parentAnchor: null, bounds: B },
  child: { id: 'child', parentAnchor: anchor('root', 500, 500, 100, 50, Math.PI / 4), bounds: B },
};
assert.equal(ws.anchorHasShear(shear.child.parentAnchor), true);
const shearRes = ws.localToWorld(shear, 'child', { x: 500, y: 500 });
assert.equal(shearRes.ok, false);
assert.equal(shearRes.error, 'shear');

// 8) Rotiert + uniform → erlaubt (kein Shear)
const okRot = {
  root: { id: 'root', parentAnchor: null, bounds: B },
  child: { id: 'child', parentAnchor: anchor('root', 500, 500, 50, 50, Math.PI / 4), bounds: B },
};
assert.equal(ws.anchorHasShear(okRot.child.parentAnchor), false);
const okRotRes = ws.localToWorld(okRot, 'child', { x: 600, y: 400 });
assert.equal(okRotRes.ok, true);
const okRotBack = ws.worldToLocal(okRot, 'child', okRotRes.value);
assert.ok(Math.abs(okRotBack.value.x - 600) < 1e-9 && Math.abs(okRotBack.value.y - 400) < 1e-9, 'rot roundtrip');

// 9) describeWorldChain liefert die geordnete ID-Kette
const desc = ws.describeWorldChain(nodes, 'taverne');
assert.equal(desc.ok, true);
assert.deepEqual(desc.value.nodeIds, ['taverne', 'ort', 'land', 'kontinent', 'welt']);

// 10) Nicht-finite Eingabe → invalid
const nanRes = ws.localToWorld(nodes, 'welt', { x: NaN, y: 0 });
assert.equal(nanRes.ok, false);
assert.equal(nanRes.error, 'invalid');

rmSync(tmp, { recursive: true, force: true });
console.log('✓ atlas-world-space.self-test: 10/10 (roundtrip, cycle, shear, missing, depth, rotation)');

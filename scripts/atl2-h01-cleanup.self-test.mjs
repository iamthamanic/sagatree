#!/usr/bin/env node
/**
 * ATL2-H01 — non-destructive product-atlas cleanup guards (#1234).
 * Location: scripts/atl2-h01-cleanup.self-test.mjs
 *
 * Locks: one productive 3D renderer (Custom WebGL, ADR-ST-10) with one host mount and one
 * canonical writer; AtlasGL / AtlasLite3D preserved; Three inventory quarantined (kept for
 * #1296); legacy Leaflet editor and the shipped HTML prototype removed from the product bundle.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });
const read = (rel) => readFileSync(join(root, rel), 'utf8');

/** @param {string} dir @returns {string[]} repo-relative source files */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    const st = statSync(join(root, rel));
    if (st.isDirectory()) out.push(...walk(rel));
    else if (/\.(tsx?|mjs|js)$/.test(name)) out.push(rel);
  }
  return out;
}

const srcFiles = walk('src');
const SPATIAL = 'src/app/world/atlas/unified/AtlasSpatialViewport.tsx';
const RUNTIME = 'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs';
const UNIFIED = 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx';

// 1) Productive renderer decision unchanged (NO-GO ADR-ST-10): Custom WebGL stays.
const target = jiti(join(root, 'src/domains/world/atlas/atlas-renderer-target.ts'));
assert.equal(target.ATLAS_PRODUCT_3D_TARGET, 'custom-webgl-prototype-runtime');
assert.equal(target.ATLAS_PRODUCT_3D_MODULE_PATH, RUNTIME);
const runtime = read(RUNTIME);
for (const needle of ['AtlasGL', 'AtlasLite3D', 'export function mountAtlasPrototype3d']) {
  assert.ok(runtime.includes(needle), `runtime keeps ${needle} (no destructive cleanup)`);
}
assert.ok(existsSync(join(root, 'docs/architecture/ADR-ST-10-atl2-r01-custom-webgl-product-sot.md')));

// 2) Exactly one product 3D host mount, controlled (generator_meta SoT, no localStorage SoT).
const mounts = srcFiles.filter((f) => /<AtlasNative3dEditor\b/.test(read(f)));
assert.deepEqual(mounts, [UNIFIED], 'single AtlasNative3dEditor JSX mount');
const unified = read(UNIFIED);
const mountIdx = unified.indexOf('<AtlasNative3dEditor');
assert.ok(/\bcontrolled\b/.test(unified.slice(mountIdx, mountIdx + 400)), 'product mount is controlled');
assert.ok(unified.includes("surfaceMode === '3d'"), '3D surface branch present (no 2D rail in 3D)');

// 3) Three inventory quarantined — kept, but nowhere imported and not barrel-exported.
assert.ok(existsSync(join(root, SPATIAL)), 'AtlasSpatialViewport kept for #1296 (not deleted)');
assert.ok(read(SPATIAL).includes('QUARANTINE (ATL2-H01 #1234'), 'quarantine marker');
const barrel = read('src/app/world/atlas/unified/index.ts');
assert.ok(!/export[^;]*AtlasSpatialViewport/.test(barrel), 'barrel does not re-export Three inventory');
const spatialImporters = srcFiles.filter(
  (f) => f !== SPATIAL && /from\s+['"][^'"]*AtlasSpatialViewport['"]/.test(read(f)),
);
assert.deepEqual(spatialImporters, [], 'no module imports AtlasSpatialViewport');
const threeInAtlas = srcFiles.filter(
  (f) => f.startsWith('src/app/world/atlas/') && f !== SPATIAL && /from\s+['"]three['"]/.test(read(f)),
);
assert.deepEqual(threeInAtlas, [], 'no second Three.js product path in the atlas');

// 4) Legacy Leaflet/Geoman 2D editor (#702) removed; no leaflet import left in product source.
assert.ok(!existsSync(join(root, 'src/app/world/atlas/WorldAtlasLeafletMap.tsx')));
const leaflet = srcFiles.filter((f) =>
  /from\s+['"](?:leaflet|react-leaflet|@geoman-io\/leaflet-geoman-free)(?:\/[^'"]*)?['"]|import\s+['"](?:leaflet|@geoman-io)/.test(
    read(f),
  ),
);
assert.deepEqual(leaflet, [], 'no leaflet / geoman import in src');

// 5) Standalone HTML prototype no longer shipped from public/ (kept as research reference).
assert.ok(!existsSync(join(root, 'public/atlas-prototype-3d.html')), 'prototype not in product bundle');
assert.ok(existsSync(join(root, '.qa/research/atlas-prototype-3d-reference.html')));
assert.ok(read('src/app/world/atlas/unified/prototype3d/README.md').includes('.qa/research/atlas-prototype-3d-reference.html'));

// 6) One canonical atlas writer: app → useWorldAtlasEditor → worldAtlasService.upsertMap → host PUT.
const appUpserts = srcFiles.filter((f) => f.startsWith('src/app/') && /worldAtlasService\s*\.\s*upsertMap\(/.test(read(f)));
assert.deepEqual(appUpserts, ['src/app/world/atlas/useWorldAtlasEditor.ts'], 'single app writer');
const hostUpsertCallers = srcFiles.filter(
  (f) => f !== 'src/infrastructure/host/host-world-http.ts' && /upsertHostWorldAtlasMap\(/.test(read(f)),
);
assert.deepEqual(hostUpsertCallers, ['src/infrastructure/world/world-atlas-service.ts'], 'single host writer');

// 7) Module boundary: domains never import app / infrastructure.
const leaks = srcFiles.filter(
  (f) => f.startsWith('src/domains/') && /from\s+['"][^'"]*\/(?:app|infrastructure)\//.test(read(f)),
);
assert.deepEqual(leaks, [], 'domains stay framework/infrastructure free');

// 8) Docs + gate wiring + typed-strict touched files.
const design = read('.qa/design/atl2-h01-cleanup.md');
const acceptance = read('.qa/acceptance/atl2-h01.md');
for (const doc of [design, acceptance]) {
  assert.ok(doc.includes('ADR-ST-10') && doc.includes('#1296'), 'docs cite ADR-ST-10 and #1296');
}
assert.ok(design.includes('Decision log'), 'ADR decision log section');
assert.ok(read('scripts/test-gate.mjs').includes('scripts/atl2-h01-cleanup.self-test.mjs'));
for (const f of [SPATIAL, 'src/app/world/atlas/unified/index.ts']) {
  const s = read(f);
  assert.ok(!/\bas any\b|@ts-ignore|@ts-expect-error/.test(s), `${relative(root, join(root, f))}: zero escape hatches`);
}

console.log(
  JSON.stringify({
    ok: true,
    productTarget: target.ATLAS_PRODUCT_3D_TARGET,
    mounts,
    quarantined: SPATIAL,
    srcFiles: srcFiles.length,
  }),
);
console.log('atl2-h01-cleanup self-test: PASS');

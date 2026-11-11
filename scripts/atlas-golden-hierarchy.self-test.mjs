#!/usr/bin/env node
/**
 * atlas-golden-hierarchy.self-test — Steps 5+6 Golden child map builders.
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'atlas-golden-h-'));
const outfile = join(tmp, 'hierarchy.mjs');

buildSync({
  entryPoints: [join(root, 'src/domains/world/atlas/dornhain-golden-hierarchy.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
});

const mod = await import(pathToFileURL(outfile).href);
assert.equal(mod.DORNHAIN_GOLDEN_MAPS.length, 5);
assert.ok(mod.isDornhainGoldenMapSeed('dornhain.unified.v4'));
assert.ok(mod.isDornhainGoldenMapSeed('dornhain.map.loc.tavern'));

for (const spec of mod.DORNHAIN_GOLDEN_MAPS) {
  const canvas = spec.buildCanvas();
  assert.ok(canvas.rooms.length >= 2, `${spec.seedKey} rooms`);
  assert.equal(canvas.demoSeed, false);
  const meta = mod.buildDornhainGoldenChildGeneratorMeta(spec, 'parent-map-id');
  assert.equal(meta.seed, spec.seedKey);
  assert.equal(meta.mapStatus, 'ready');
  assert.equal(meta.mapFrame.parentAnchor.parentMapId, 'parent-map-id');
  assert.ok(meta.mapFrame.parentAnchor.extentX > 0);
}

const resetSrc = readFileSync(join(root, 'src/domains/world/atlas/dornhain-golden-reset.ts'), 'utf8');
assert.match(resetSrc, /continent\.westmark/);
assert.match(resetSrc, /goldenMapSeeds/);

const editorSrc = readFileSync(join(root, 'src/app/world/atlas/useWorldAtlasEditor.ts'), 'utf8');
assert.match(editorSrc, /DORNHAIN_GOLDEN_MAPS/);
assert.match(editorSrc, /buildDornhainGoldenChildGeneratorMeta/);

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
assert.match(gate, /atlas-golden-hierarchy\.self-test\.mjs/);

rmSync(tmp, { recursive: true, force: true });
console.log('atlas-golden-hierarchy self-test: PASS');

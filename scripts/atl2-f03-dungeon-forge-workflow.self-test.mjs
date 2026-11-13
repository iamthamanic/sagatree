#!/usr/bin/env node
/**
 * ATL2-F03 — Dungeon preview / commit / safe reforge workflow.
 * Location: scripts/atl2-f03-dungeon-forge-workflow.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-f03.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const workflowSrc = readFileSync(
  join(root, 'src/domains/world/atlas/dungeon-forge-workflow.ts'),
  'utf8',
);
const editorSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'),
  'utf8',
);
const indexSrc = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');

assert.ok(acceptance.includes('atl2-f03'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(acceptance.includes('IV-18'));
assert.ok(gate.includes('atl2-f03-dungeon-forge-workflow.self-test.mjs'));
assert.ok(indexSrc.includes('commitDungeonFeaturesToDoc'));
assert.ok(indexSrc.includes('mergeDungeonPreviewIntoDoc'));
assert.ok(workflowSrc.includes('stripDungeonGeneratedFeatures'));
assert.ok(workflowSrc.includes('replaceGenerated'));
assert.ok(!workflowSrc.includes(' as any'));
assert.ok(!workflowSrc.includes('@ts-ignore'));
assert.ok(!workflowSrc.includes('@ts-expect-error'));
assert.ok(editorSrc.includes('mergeDungeonPreviewIntoDoc'));
assert.ok(editorSrc.includes('commitDungeonFeaturesToDoc'));
assert.ok(editorSrc.includes('rasterizeDungeonGenerateResult'));
assert.ok(editorSrc.includes('data-atlas-dungeon-cancel'));
assert.ok(editorSrc.includes('forgeDisplayDoc'));
assert.ok(editorSrc.includes('forge3dMapKey'));
assert.ok(editorSrc.includes('Ungültiger Seed'));
assert.ok(editorSrc.includes('/^\\d+$/'));
assert.ok(editorSrc.includes("data-atlas-dungeon-forge-3d"));
/* Preview must not write into canonical persist path. */
assert.ok(editorSrc.includes('dungeonPreviewRef.current?.payload'));

const gen = jiti(join(root, 'src/domains/world/atlas/dungeon-generator.ts'));
const grid = jiti(join(root, 'src/domains/world/atlas/dungeon-grid.ts'));
const forge = jiti(join(root, 'src/domains/world/atlas/dungeon-forge-workflow.ts'));
const canvas = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));

const baseParams = {
  seed: 4242,
  roomCount: 16,
  loopChance: 0.2,
  themeKey: 'ancient',
  originX: 10,
  originY: 20,
  unitScale: 1,
};

const result = gen.generateDungeon(baseParams);
assert.equal(result.valid, true, result.error);
const raster = grid.rasterizeDungeonGenerateResult(result);
assert.equal(raster.valid, true, raster.error);
assert.equal(raster.passable, true);

const payload = forge.dungeonCommitPayloadFromResults(result, raster);
assert.ok(payload);
assert.ok(payload.rooms.length > 0);
assert.ok(payload.walls.length > 0);
assert.ok(payload.doors.length > 0);

const userRoom = {
  id: 'user-room-1',
  x: 0,
  y: 0,
  w: 4,
  h: 4,
  material: 'stein',
};
const baseDoc = {
  ...canvas.emptyUnifiedCanvasDoc(false),
  rooms: [userRoom],
};

/* Preview merge is display-only overlay: strips prior dungeon IDs, keeps user rooms. */
const previewDoc = forge.mergeDungeonPreviewIntoDoc(baseDoc, payload);
assert.ok(previewDoc.rooms.some((r) => r.id === 'user-room-1'));
assert.ok(previewDoc.rooms.some((r) => r.id.startsWith('droom-')));
assert.equal(baseDoc.rooms.length, 1, 'canonical base unchanged by preview helper');
assert.equal(baseDoc.rooms[0].id, 'user-room-1');

/* First commit with replaceGenerated replaces only generator IDs (none yet). */
const committed = forge.commitDungeonFeaturesToDoc(baseDoc, payload, true);
assert.ok(committed.rooms.some((r) => r.id === 'user-room-1'));
assert.ok(committed.rooms.filter((r) => r.id.startsWith('droom-')).length === payload.rooms.length);
assert.ok(committed.doors.length === payload.doors.length);

/* Manual dirty reforge: second generate+commit replaces generator IDs, keeps user room. */
const result2 = gen.generateDungeon({ ...baseParams, seed: 7777, roomCount: 12 });
assert.equal(result2.valid, true, result2.error);
const raster2 = grid.rasterizeDungeonGenerateResult(result2);
assert.equal(raster2.valid && raster2.passable, true, raster2.error);
const payload2 = forge.dungeonCommitPayloadFromResults(result2, raster2);
assert.ok(payload2);
const reforged = forge.commitDungeonFeaturesToDoc(committed, payload2, true);
assert.ok(reforged.rooms.some((r) => r.id === 'user-room-1'));
assert.equal(
  reforged.rooms.filter((r) => r.id.startsWith('droom-')).length,
  payload2.rooms.length,
);
const oldDungeonIds = new Set(payload.rooms.map((r) => r.id));
assert.ok(
  !reforged.rooms.some((r) => oldDungeonIds.has(r.id)),
  'reforge must drop prior generator room ids',
);

/* Failed generate → no payload → commit helpers must not invent geometry. */
assert.equal(
  forge.dungeonCommitPayloadFromResults(
    { valid: false, error: 'generation failed' },
    { valid: false, passable: false },
  ),
  null,
);
assert.equal(
  forge.dungeonCommitPayloadFromResults(result, {
    ...raster,
    valid: false,
    passable: false,
  }),
  null,
);

/* Cancel semantics: strip leaves only non-generator features. */
const stripped = forge.stripDungeonGeneratedFeatures(committed);
assert.deepEqual(
  stripped.rooms.map((r) => r.id),
  ['user-room-1'],
);
assert.equal(stripped.walls.length, 0);
assert.equal((stripped.doors ?? []).length, 0);

/* Meta reforge guard */
assert.equal(gen.dungeonNeedsReforgeConfirm(null), false);
assert.equal(
  gen.dungeonNeedsReforgeConfirm(gen.buildDungeonGeneratorMeta(result, true)),
  true,
);
assert.equal(
  gen.dungeonNeedsReforgeConfirm({
    ...gen.buildDungeonGeneratorMeta(result, false),
    manualDirty: true,
  }),
  true,
);

console.log('atl2-f03-dungeon-forge-workflow.self-test: PASS');

#!/usr/bin/env node
/**
 * ATL2-F02 — Dungeon grid rasterize / BFS / editable feature IDs.
 * Location: scripts/atl2-f02-dungeon-grid.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-f02.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const gridSrc = readFileSync(join(root, 'src/domains/world/atlas/dungeon-grid.ts'), 'utf8');
const indexSrc = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');

assert.ok(acceptance.includes('atl2-f02'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(gate.includes('atl2-f02-dungeon-grid.self-test.mjs'));
assert.ok(indexSrc.includes('rasterizeDungeonLayout'));
assert.ok(gridSrc.includes('bfsDungeonPassability'));
assert.ok(!gridSrc.includes(' as any'));
assert.ok(!gridSrc.includes('@ts-ignore'));
assert.ok(!gridSrc.includes('@ts-expect-error'));

const gen = jiti(join(root, 'src/domains/world/atlas/dungeon-generator.ts'));
const grid = jiti(join(root, 'src/domains/world/atlas/dungeon-grid.ts'));

const base = {
  seed: 4242,
  roomCount: 16,
  loopChance: 0.2,
  themeKey: 'ancient',
  originX: 0,
  originY: 0,
  unitScale: 1,
};

const a = gen.generateDungeon(base);
assert.equal(a.valid, true, a.error);
const ra = grid.rasterizeDungeonGenerateResult(a);
assert.equal(ra.valid, true, ra.error);
assert.equal(ra.passable, true, `not passable reachable=${ra.reachableFloorCount} floor=${ra.floorCount}`);
assert.ok(ra.floorCount > 0);
assert.ok(ra.wallCount > 0);
assert.ok(ra.doorwayCount > 0);
assert.ok(ra.canvasRooms.length === a.rooms.length);
assert.ok(ra.canvasWalls.length > 0);
assert.ok(ra.canvasDoors.length > 0);
assert.ok(ra.canvasRooms.every((r) => typeof r.id === 'string' && r.id.startsWith('droom-')));
assert.ok(ra.canvasDoors.every((d) => typeof d.id === 'string' && d.wallId));

const rb = grid.rasterizeDungeonGenerateResult(a);
assert.deepEqual(
  ra.cells.map((c) => `${c.x},${c.y},${c.kind},${c.roomId},${c.isCorridor},${c.isDoorway}`),
  rb.cells.map((c) => `${c.x},${c.y},${c.kind},${c.roomId},${c.isCorridor},${c.isDoorway}`),
  'rasterize not deterministic',
);
assert.deepEqual(
  ra.canvasDoors.map((d) => d.id),
  rb.canvasDoors.map((d) => d.id),
);

/* Negative: wipe floors except entrance → BFS fail */
const kinds = new Uint8Array(ra.width * ra.height);
for (const c of ra.cells) {
  if (c.kind === grid.DUNGEON_CELL_FLOOR) kinds[c.y * ra.width + c.x] = grid.DUNGEON_CELL_FLOOR;
}
const entrance = a.rooms.find((r) => r.type === 'entrance');
assert.ok(entrance);
const sx = Math.round(entrance.cx + ra.originGX);
const sy = Math.round(entrance.cy + ra.originGY);
// Disconnect: clear all but a tiny island at entrance
for (let i = 0; i < kinds.length; i += 1) kinds[i] = grid.DUNGEON_CELL_VOID;
kinds[sy * ra.width + sx] = grid.DUNGEON_CELL_FLOOR;
kinds[sy * ra.width + sx + 1] = grid.DUNGEON_CELL_FLOOR;
const bfs = grid.bfsDungeonPassability(ra.width, ra.height, kinds, sx, sy);
assert.equal(bfs.reachable, 2);
assert.ok(bfs.reachable < ra.floorCount);

/* Min rooms still rasterize */
const min = gen.generateDungeon({ ...base, seed: 9, roomCount: 4 });
assert.equal(min.valid, true, min.error);
const rmin = grid.rasterizeDungeonGenerateResult(min);
assert.equal(rmin.valid, true, rmin.error);
assert.equal(rmin.passable, true);

/* Theme liquid optional — molten may add liquid but stay passable */
const molten = gen.generateDungeon({ ...base, seed: 4242, themeKey: 'molten' });
const rm = grid.rasterizeDungeonGenerateResult(molten, { enableLiquidPits: true });
assert.equal(rm.valid, true, rm.error);
assert.equal(rm.passable, true, 'liquid must not break entrance→floor BFS');

console.log(
  JSON.stringify({
    ok: true,
    seed: a.seed,
    floor: ra.floorCount,
    walls: ra.wallCount,
    doorways: ra.doorwayCount,
    doors: ra.canvasDoors.length,
    liquid: rm.liquidCount,
    grid: `${ra.width}x${ra.height}`,
  }),
);
console.log('atl2-f02-dungeon-grid.self-test: OK');

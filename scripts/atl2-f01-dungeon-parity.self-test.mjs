#!/usr/bin/env node
/**
 * ATL2-F01 — Dungeon Forge algorithm parity (determinism, roles, connectivity).
 * Location: scripts/atl2-f01-dungeon-parity.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-f01.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const genSrc = readFileSync(join(root, 'src/domains/world/atlas/dungeon-generator.ts'), 'utf8');
const attr = readFileSync(join(root, 'src/domains/world/atlas/THIRD_PARTY_DUNGEON_FORGE.md'), 'utf8');
const license = readFileSync(join(root, 'third_party/dungeon-forge/LICENSE'), 'utf8');
const readme = readFileSync(join(root, 'third_party/dungeon-forge/README.md'), 'utf8');

assert.ok(acceptance.includes('atl2-f01'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(acceptance.includes('IV-18'));
assert.ok(gate.includes('atl2-f01-dungeon-parity.self-test.mjs'));
assert.ok(attr.includes('MIT'));
assert.ok(attr.includes('Majid Manzarpour'));
assert.ok(license.includes('MIT License'));
assert.ok(license.includes('Majid Manzarpour'));
assert.ok(readme.includes('dungeon-generator.ts'));
assert.ok(!existsSync(join(root, 'src/app/world/atlas/unified/dungeon-forge-main.js')));
assert.ok(!genSrc.includes('from \'three\''));
assert.ok(!genSrc.includes('from "three"'));
assert.ok(genSrc.includes('isCritical = true'));
assert.ok(genSrc.includes("type = 'treasure'"));
assert.ok(genSrc.includes("type = 'shrine'"));
assert.ok(genSrc.includes("type = 'elite'"));
assert.ok(genSrc.includes('Leaf guard'));
assert.ok(!genSrc.includes(' as any'));
assert.ok(!genSrc.includes('@ts-ignore'));
assert.ok(!genSrc.includes('@ts-expect-error'));

const mod = jiti(join(root, 'src/domains/world/atlas/dungeon-generator.ts'));

const {
  DUNGEON_GENERATOR_VERSION,
  DUNGEON_ROOM_COUNT_MIN,
  DUNGEON_ROOM_COUNT_MAX,
  generateDungeon,
  normalizeDungeonGenerateParams,
  validateDungeonConnectivity,
  validateDungeonSemantics,
  fingerprintDungeonLayout,
  dungeonNeedsReforgeConfirm,
  buildDungeonGeneratorMeta,
} = mod;

assert.equal(DUNGEON_ROOM_COUNT_MIN, 4);
assert.equal(DUNGEON_ROOM_COUNT_MAX, 80);
assert.equal(DUNGEON_GENERATOR_VERSION, 'sagatree-dungeon-forge-v2');

const baseParams = {
  seed: 4242,
  roomCount: 16,
  loopChance: 0.2,
  themeKey: 'ancient',
  originX: 0,
  originY: 0,
  unitScale: 1,
};

const a = generateDungeon(baseParams);
assert.equal(a.valid, true, a.error);
const semA = validateDungeonSemantics(a.rooms, a.edges);
assert.equal(semA.ok, true, semA.error);
assert.ok(validateDungeonConnectivity(a.rooms.length, a.edges, semA.entranceId));
assert.equal(a.canvasRooms.length, a.rooms.length);
assert.ok(a.canvasWalls.length >= a.rooms.length);
assert.ok(semA.criticalEdgeCount >= 1);
assert.equal(semA.roleCounts.entrance, 1);
assert.equal(semA.roleCounts.boss, 1);

const b = generateDungeon(baseParams);
assert.equal(fingerprintDungeonLayout(a), fingerprintDungeonLayout(b), 'not deterministic');
assert.deepEqual(a.rooms, b.rooms);
assert.deepEqual(a.edges, b.edges);
assert.deepEqual(
  a.canvasRooms.map((r) => r.id),
  b.canvasRooms.map((r) => r.id),
);

/* Reference fingerprint lock — algorithm drift must update this literal intentionally. */
const EXPECTED_FP_SEED_4242 =
  'v=sagatree-dungeon-forge-v2;seed=4242;rooms=[0:-26,0,9x12:combat:6|1:-8,10,5x6:elite:4|2:34,0,11x11:entrance:0|3:2,-28,12x9:treasure:5|4:2,10,5x5:shrine:5|5:-15,-7,6x6:combat:4|6:2,-15,15x13:combat:4|7:3,19,11x9:treasure:6|8:-27,-15,13x15:combat:5|9:21,0,11x11:combat:1|10:-13,21,18x13:boss:5|11:-16,1,7x7:shrine:5|12:-4,-1,12x11:combat:3|13:18,-14,12x10:treasure:2|14:-11,-16,7x7:combat:5|15:9,-1,10x12:combat:2];edges=[1-4:T|4-7:T|5-8:T|0-8:L|2-9:TC|1-10:TC|0-11:T|5-11:T|10-11:L|1-11:T|1-12:TC|5-12:L|9-13:T|3-6:T|6-14:T|5-14:T|6-12:L|9-15:TC|12-15:TC];ids=[droom-4242-0|droom-4242-1|droom-4242-2|droom-4242-3|droom-4242-4|droom-4242-5|droom-4242-6|droom-4242-7|droom-4242-8|droom-4242-9|droom-4242-10|droom-4242-11|droom-4242-12|droom-4242-13|droom-4242-14|droom-4242-15|dwall-4242-0-0|dwall-4242-0-1|dwall-4242-0-2|dwall-4242-0-3|dwall-4242-1-0|dwall-4242-1-1|dwall-4242-1-2|dwall-4242-1-3|dwall-4242-2-0|dwall-4242-2-1|dwall-4242-2-2|dwall-4242-2-3|dwall-4242-3-0|dwall-4242-3-1|dwall-4242-3-2|dwall-4242-3-3|dwall-4242-4-0|dwall-4242-4-1|dwall-4242-4-2|dwall-4242-4-3|dwall-4242-5-0|dwall-4242-5-1|dwall-4242-5-2|dwall-4242-5-3|dwall-4242-6-0|dwall-4242-6-1|dwall-4242-6-2|dwall-4242-6-3|dwall-4242-7-0|dwall-4242-7-1|dwall-4242-7-2|dwall-4242-7-3|dwall-4242-8-0|dwall-4242-8-1|dwall-4242-8-2|dwall-4242-8-3|dwall-4242-9-0|dwall-4242-9-1|dwall-4242-9-2|dwall-4242-9-3|dwall-4242-10-0|dwall-4242-10-1|dwall-4242-10-2|dwall-4242-10-3|dwall-4242-11-0|dwall-4242-11-1|dwall-4242-11-2|dwall-4242-11-3|dwall-4242-12-0|dwall-4242-12-1|dwall-4242-12-2|dwall-4242-12-3|dwall-4242-13-0|dwall-4242-13-1|dwall-4242-13-2|dwall-4242-13-3|dwall-4242-14-0|dwall-4242-14-1|dwall-4242-14-2|dwall-4242-14-3|dwall-4242-15-0|dwall-4242-15-1|dwall-4242-15-2|dwall-4242-15-3|dcorr-4242-1-4|dcorr-4242-4-7|dcorr-4242-5-8|dcorr-4242-0-8|dcorr-4242-2-9|dcorr-4242-1-10|dcorr-4242-0-11|dcorr-4242-5-11|dcorr-4242-10-11|dcorr-4242-1-11|dcorr-4242-1-12|dcorr-4242-5-12|dcorr-4242-9-13|dcorr-4242-3-6|dcorr-4242-6-14|dcorr-4242-5-14|dcorr-4242-6-12|dcorr-4242-9-15|dcorr-4242-12-15|dlamp-4242-entrance|dchest-4242-boss]';
const expectedFp = fingerprintDungeonLayout(a);
assert.equal(expectedFp, EXPECTED_FP_SEED_4242);

const roleKinds = new Set(a.rooms.map((r) => r.type));
assert.ok(roleKinds.has('entrance'));
assert.ok(roleKinds.has('boss'));
assert.ok(roleKinds.has('combat'));
/* With 16 rooms + loops, forge semantics usually yields ≥1 of these; require when available. */
const semanticRoles = ['treasure', 'shrine', 'elite'].filter((k) => roleKinds.has(k));
assert.ok(
  semanticRoles.length >= 1,
  `expected treasure/shrine/elite for seed 4242, got ${[...roleKinds].join(',')}`,
);

const minD = generateDungeon({ ...baseParams, seed: 7, roomCount: 1 });
assert.equal(minD.valid, true, minD.error);
assert.equal(minD.stats.roomCount, DUNGEON_ROOM_COUNT_MIN);
assert.equal(minD.params.roomCount, DUNGEON_ROOM_COUNT_MIN);

const maxD = generateDungeon({ ...baseParams, seed: 99, roomCount: 500 });
assert.equal(maxD.valid, true, maxD.error);
assert.equal(maxD.stats.roomCount, DUNGEON_ROOM_COUNT_MAX);
assert.equal(maxD.params.roomCount, DUNGEON_ROOM_COUNT_MAX);

const neg = normalizeDungeonGenerateParams({
  seed: Number.NaN,
  roomCount: -12,
  loopChance: 4,
  themeKey: 'not-a-theme',
  originX: Number.POSITIVE_INFINITY,
  originY: Number.NaN,
  unitScale: -3,
});
assert.equal(neg.seed, 0);
assert.equal(neg.roomCount, DUNGEON_ROOM_COUNT_MIN);
assert.equal(neg.loopChance, 1);
assert.equal(neg.themeKey, 'ancient');
assert.equal(neg.originX, 0);
assert.equal(neg.originY, 0);
assert.equal(neg.unitScale, 1);

const fromNorm = generateDungeon(neg);
assert.equal(fromNorm.valid, true, fromNorm.error);
assert.ok(validateDungeonSemantics(fromNorm.rooms, fromNorm.edges).ok);

/* Loop / edge metrics across loopChance extremes */
const noLoops = generateDungeon({ ...baseParams, seed: 111, loopChance: 0 });
assert.equal(noLoops.valid, true, noLoops.error);
assert.equal(
  noLoops.edges.filter((e) => e.isLoop).length,
  0,
  'loopChance 0 must produce zero loop edges',
);
assert.equal(noLoops.edges.length, noLoops.rooms.length - 1, 'MST edge count');

const manyLoops = generateDungeon({ ...baseParams, seed: 111, loopChance: 1 });
assert.equal(manyLoops.valid, true, manyLoops.error);
assert.ok(manyLoops.edges.length >= noLoops.edges.length);

/* Large N leaf guard: at least 3 degree-1 rooms when possible */
const large = generateDungeon({ ...baseParams, seed: 2024, roomCount: 24, loopChance: 0.35 });
assert.equal(large.valid, true, large.error);
const degree = new Array(large.rooms.length).fill(0);
for (const e of large.edges) {
  degree[e.a] += 1;
  degree[e.b] += 1;
}
const leaves = degree.filter((d) => d === 1).length;
assert.ok(leaves >= 3, `leaf guard expected ≥3 leaves, got ${leaves}`);

/* Reforge guard composition */
const meta = buildDungeonGeneratorMeta(a, true);
assert.equal(dungeonNeedsReforgeConfirm(meta), true);
assert.equal(dungeonNeedsReforgeConfirm({ ...meta, confirmed: false, manualDirty: true }), true);
assert.equal(dungeonNeedsReforgeConfirm({ ...meta, confirmed: false, manualDirty: false }), false);
assert.equal(dungeonNeedsReforgeConfirm(null), false);

/* Disconnected edges fail closed */
assert.equal(validateDungeonConnectivity(3, [{ a: 0, b: 1, isLoop: false, isCritical: false }]), false);
assert.equal(
  validateDungeonSemantics(
    [
      { id: 0, cx: 0, cy: 0, w: 5, h: 5, type: 'entrance', depth: 0 },
      { id: 1, cx: 1, cy: 0, w: 5, h: 5, type: 'combat', depth: 1 },
    ],
    [],
  ).ok,
  false,
);

/* Incomplete critical path (entrance—combat—boss with only first edge critical) fails closed */
const incompleteCrit = validateDungeonSemantics(
  [
    { id: 0, cx: 0, cy: 0, w: 5, h: 5, type: 'entrance', depth: 0 },
    { id: 1, cx: 1, cy: 0, w: 5, h: 5, type: 'combat', depth: 1 },
    { id: 2, cx: 2, cy: 0, w: 8, h: 8, type: 'boss', depth: 2 },
  ],
  [
    { a: 0, b: 1, isLoop: false, isCritical: true },
    { a: 1, b: 2, isLoop: false, isCritical: false },
  ],
);
assert.equal(incompleteCrit.ok, false);
assert.match(String(incompleteCrit.error), /critical/i);

console.log(
  JSON.stringify({
    ok: true,
    seed: a.seed,
    rooms: a.stats.roomCount,
    edges: a.stats.edgeCount,
    critical: semA.criticalEdgeCount,
    loops: semA.loopEdgeCount,
    roles: semA.roleCounts,
    fingerprintChars: EXPECTED_FP_SEED_4242.length,
    genMs: +a.stats.genMs.toFixed(3),
  }),
);
console.log('atl2-f01-dungeon-parity.self-test: OK');

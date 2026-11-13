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
assert.equal(DUNGEON_GENERATOR_VERSION, 'sagatree-dungeon-forge-v1');

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

/* Reference fingerprint lock — algorithm drift must update this intentionally. */
const expectedFp = fingerprintDungeonLayout(a);
assert.ok(expectedFp.includes('v=sagatree-dungeon-forge-v1'));
assert.ok(expectedFp.includes(`seed=${a.seed}`));
assert.match(expectedFp, /entrance/);
assert.match(expectedFp, /boss/);
assert.match(expectedFp, /C/); // at least one critical edge marker

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

console.log(
  JSON.stringify({
    ok: true,
    seed: a.seed,
    rooms: a.stats.roomCount,
    edges: a.stats.edgeCount,
    critical: semA.criticalEdgeCount,
    loops: semA.loopEdgeCount,
    roles: semA.roleCounts,
    fingerprintChars: expectedFp.length,
    genMs: +a.stats.genMs.toFixed(3),
  }),
);
console.log('atl2-f01-dungeon-parity.self-test: OK');

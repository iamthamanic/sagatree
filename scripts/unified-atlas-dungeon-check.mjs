#!/usr/bin/env node
/**
 * unified-atlas-dungeon-check — deterministic dungeon generator domain smoke.
 * Location: scripts/unified-atlas-dungeon-check.mjs
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function mustInclude(rel, needles) {
  const path = join(root, rel);
  if (!existsSync(path)) throw new Error(`missing ${rel}`);
  const text = readFileSync(path, 'utf8');
  for (const n of needles) {
    if (!text.includes(n)) throw new Error(`missing ${n} in ${rel}`);
  }
}

mustInclude('src/domains/world/atlas/dungeon-generator.ts', [
  'generateDungeon',
  'validateDungeonConnectivity',
  'validateDungeonSemantics',
  'normalizeDungeonGenerateParams',
  'fingerprintDungeonLayout',
  'DUNGEON_GENERATOR_VERSION',
  'buildDungeonGeneratorMeta',
  'dungeonNeedsReforgeConfirm',
  'manualDirty',
  "type = 'treasure'",
  "type = 'shrine'",
  "type = 'elite'",
  'isCritical = true',
]);
mustInclude('src/domains/world/atlas/THIRD_PARTY_DUNGEON_FORGE.md', ['MIT', 'Majid Manzarpour']);
mustInclude('third_party/dungeon-forge/LICENSE', ['MIT License', 'Majid Manzarpour']);

const outDir = join(root, '.qa/tmp');
mkdirSync(outDir, { recursive: true });
const bundle = join(outDir, 'dungeon-gen-bundle.mjs');
// Prefer npm bin shim (works on Linux CI); bin/esbuild is a native ELF and must not be run via node.
const esbuildBin = join(root, 'node_modules', '.bin', 'esbuild');
const esbuildNative = join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');
const esbuild = existsSync(esbuildBin) ? esbuildBin : esbuildNative;
if (!existsSync(esbuild)) throw new Error('esbuild missing');

const build = spawnSync(
  esbuild,
  [
    'src/domains/world/atlas/dungeon-generator.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${bundle}`,
  ],
  { encoding: 'utf8', cwd: root },
);
if (build.status !== 0) {
  console.error(build.stdout, build.stderr);
  process.exit(build.status || 1);
}

const mod = await import(pathToFileURL(bundle).href);
const { generateDungeon, validateDungeonConnectivity, validateDungeonSemantics } = mod;
const a = generateDungeon({
  seed: 4242,
  roomCount: 16,
  loopChance: 0.2,
  themeKey: 'ancient',
  originX: 0,
  originY: 0,
  unitScale: 1,
});
if (!a.valid) throw new Error(`gen failed: ${a.error}`);
const sem = validateDungeonSemantics(a.rooms, a.edges);
if (!sem.ok) throw new Error(`semantics: ${sem.error}`);
if (!validateDungeonConnectivity(a.rooms.length, a.edges, sem.entranceId)) {
  throw new Error('disconnected');
}
if (a.canvasRooms.length !== a.rooms.length) throw new Error('room export mismatch');
if (a.canvasWalls.length < a.rooms.length) throw new Error('walls missing');
const b = generateDungeon({
  seed: 4242,
  roomCount: 16,
  loopChance: 0.2,
  themeKey: 'ancient',
  originX: 0,
  originY: 0,
  unitScale: 1,
});
if (JSON.stringify(a.rooms) !== JSON.stringify(b.rooms)) throw new Error('not deterministic');
if (JSON.stringify(a.edges) !== JSON.stringify(b.edges)) throw new Error('edges not deterministic');

console.log(
  JSON.stringify({
    ok: true,
    seed: a.seed,
    rooms: a.stats.roomCount,
    edges: a.stats.edgeCount,
    critical: sem.criticalEdgeCount,
    loops: sem.loopEdgeCount,
    roles: sem.roleCounts,
    genMs: +a.stats.genMs.toFixed(3),
  }),
);

try {
  unlinkSync(bundle);
} catch {
  /* ignore */
}

console.log('unified-atlas-dungeon-check: OK');

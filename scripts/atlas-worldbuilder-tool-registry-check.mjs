#!/usr/bin/env node
/**
 * atlas-worldbuilder-tool-registry-check — contextual AtlasTool registry (#720).
 * Location: scripts/atlas-worldbuilder-tool-registry-check.mjs
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-worldbuilder-tool-registry-check failed: ${msg}`);
  process.exit(1);
}

function mustInclude(rel, needles) {
  const path = join(root, rel);
  if (!existsSync(path)) fail(`missing ${rel}`);
  const text = readFileSync(path, 'utf8');
  for (const n of needles) {
    if (!text.includes(n)) fail(`missing ${n} in ${rel}`);
  }
}

mustInclude('.qa/acceptance/atlas-worldbuilder-tool-registry.md', ['#720', 'ATLAS_TOOL_REGISTRY']);
mustInclude('src/domains/world/atlas/atlas-tool-registry.ts', [
  'atlasToolsForKind',
  'createsCanonicalNode: false',
  'Footprint',
]);
mustInclude('src/app/world/atlas/unified/UnifiedAtlasEditor.tsx', [
  'atlasToolsForKind',
  'activeNodeKind',
  'isAtlasToolAllowed',
]);
mustInclude('src/app/world/atlas/WorldAtlasWorkbench.tsx', ['activeNodeKind']);

const outDir = join(root, '.qa/tmp');
mkdirSync(outDir, { recursive: true });
const bundle = join(outDir, 'atlas-tool-registry-bundle.mjs');
const esbuildBin = join(root, 'node_modules', '.bin', 'esbuild');
const esbuild = existsSync(esbuildBin)
  ? esbuildBin
  : join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');

const build = spawnSync(
  esbuild,
  [
    'src/domains/world/atlas/atlas-tool-registry.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${bundle}`,
  ],
  { cwd: root, encoding: 'utf8' },
);
if (build.status !== 0) fail(`esbuild failed: ${build.stderr || build.stdout}`);

const mod = await import(pathToFileURL(bundle).href);
const building = mod.atlasToolsForKind('building').map((t) => t.id);
if (!building.includes('wall') || !building.includes('stamp')) fail('building tools missing');
if (building.includes('brush')) fail('building must not get continent brush');
if (mod.ATLAS_TOOL_REGISTRY.some((t) => t.createsCanonicalNode !== false)) {
  fail('stamps must not create canonical nodes');
}

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-tool-registry-check.mjs')) {
  fail('test-gate must invoke tool-registry check');
}

try {
  unlinkSync(bundle);
} catch {
  /* ignore */
}

console.log('atlas-worldbuilder-tool-registry-check: OK');

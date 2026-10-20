#!/usr/bin/env node
/**
 * atlas-worldbuilder-webgl-tool-registry-check — WebGL chrome from registry (#750).
 * Location: scripts/atlas-worldbuilder-webgl-tool-registry-check.mjs
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const evid = join(root, '.qa/evidence/atlas-followup-webgl-tool-registry');

function fail(msg) {
  console.error(`atlas-worldbuilder-webgl-tool-registry-check failed: ${msg}`);
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

mustInclude('.qa/acceptance/atlas-followup-webgl-tool-registry.md', [
  '#750',
  'ATLAS_TOOL_REGISTRY',
  'webglToolChromeForKind',
  'assertWebglToolCommit',
]);

mustInclude('src/domains/world/atlas/atlas-tool-registry.ts', [
  'webglToolChromeForKind',
  'assertWebglToolCommit',
  'atlasToolToWebglRuntimeId',
  "toolId === 'brush'",
  'createsCanonicalNode: false',
]);

mustInclude('src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs', [
  'toolChrome',
  'setToolChrome',
  'allowMutation',
  'data-atlas-tool-source',
  'DEMO_TOOL_CHROME',
  'Keine Bearbeitungsrechte',
]);

mustInclude('src/app/world/atlas/unified/AtlasNative3dEditor.tsx', [
  'webglToolChromeForKind',
  'activeNodeKind',
  'setToolChrome',
  'canEdit',
]);

mustInclude('src/app/world/atlas/unified/UnifiedAtlasEditor.tsx', [
  'activeNodeKind={activeNodeKind',
  'canEdit={canEdit}',
]);

const outDir = join(root, '.qa/tmp');
mkdirSync(outDir, { recursive: true });
mkdirSync(evid, { recursive: true });
const bundle = join(outDir, 'atlas-webgl-tool-registry-bundle.mjs');
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

const country = mod.webglToolChromeForKind('country');
const countryIds = country.map((t) => t.atlasId);
if (!countryIds.includes('brush')) fail('country must offer terrain brush');
if (!countryIds.includes('road')) fail('country must offer road/border tool');
if (countryIds.includes('wall') || countryIds.includes('room')) {
  fail('country must not offer room/wall tools');
}
const road = country.find((t) => t.atlasId === 'road');
if (!road || road.enabled !== false) fail('road must be listed disabled in WebGL chrome');
if (road.runtimeId !== 'road') fail('road runtime id');

const building = mod.webglToolChromeForKind('building');
const buildingIds = building.map((t) => t.atlasId);
if (!buildingIds.includes('wall') || !buildingIds.includes('room') || !buildingIds.includes('stamp')) {
  fail('building must offer wall/room/stamp');
}
if (buildingIds.includes('brush')) fail('building must not get continent brush');

const paintOk = mod.assertWebglToolCommit({
  runtimeToolId: 'paint',
  kind: 'country',
  canEdit: true,
});
if (!paintOk.ok) fail('paint on country should commit');

const wallBad = mod.assertWebglToolCommit({
  runtimeToolId: 'wall',
  kind: 'country',
  canEdit: true,
});
if (wallBad.ok) fail('wall on country must be rejected');

const noEdit = mod.assertWebglToolCommit({
  runtimeToolId: 'paint',
  kind: 'country',
  canEdit: false,
});
if (noEdit.ok) fail('canEdit=false must reject commit');

const reset = mod.resolveWebglToolAfterKindChange('wall', 'country');
if (reset !== 'hand') fail('illegal tool must reset to hand');

if (mod.ATLAS_TOOL_REGISTRY.some((t) => t.createsCanonicalNode !== false)) {
  fail('stamps must not create canonical nodes');
}

const runtime = readFileSync(
  join(root, 'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs'),
  'utf8',
);
if (runtime.includes("const tools=[['hand','Verschieben']")) {
  fail('hardcoded product tools array must be removed');
}

writeFileSync(
  join(evid, 'chrome-matrix.json'),
  JSON.stringify(
    {
      country: country.map((t) => ({
        atlasId: t.atlasId,
        runtimeId: t.runtimeId,
        enabled: t.enabled,
        role: t.role,
      })),
      building: building.map((t) => ({
        atlasId: t.atlasId,
        runtimeId: t.runtimeId,
        enabled: t.enabled,
        role: t.role,
      })),
      asserts: {
        paintCountryOk: paintOk.ok,
        wallCountryRejected: !wallBad.ok,
        noEditRejected: !noEdit.ok,
        resetToHand: reset,
      },
    },
    null,
    2,
  ) + '\n',
);

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-webgl-tool-registry-check.mjs')) {
  fail('test-gate must invoke webgl tool-registry check');
}

try {
  unlinkSync(bundle);
} catch {
  /* ignore */
}

console.log('atlas-worldbuilder-webgl-tool-registry-check: OK');

#!/usr/bin/env node
/**
 * atlas-worldbuilder-editor-durability-check — persist status + CAS conflict (#751).
 * Location: scripts/atlas-worldbuilder-editor-durability-check.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-worldbuilder-editor-durability-check failed: ${msg}`);
  process.exit(1);
}

function mustInclude(rel, needles) {
  const path = join(root, rel);
  if (!existsSync(path)) fail(`missing ${rel}`);
  const text = readFileSync(path, 'utf8');
  for (const n of needles) {
    if (!text.includes(n)) fail(`missing ${JSON.stringify(n)} in ${rel}`);
  }
}

mustInclude('.qa/acceptance/atlas-followup-editor-durability.md', ['#751', 'revision']);
mustInclude('src/domains/world/atlas/atlas-persist-state.ts', [
  'reduceAtlasPersistStatus',
  'isAtlasRevisionConflictMessage',
  'conflict',
]);
mustInclude('src/app/world/atlas/useWorldAtlasEditor.ts', [
  'persistStatus',
  'reloadActiveMap',
  'expectedRevision',
  'isAtlasRevisionConflictMessage',
  'saveInFlightRef',
]);
mustInclude('src/app/world/atlas/WorldAtlasWorkbench.tsx', [
  'data-atlas-revision-conflict',
  'data-atlas-conflict-reload',
  'data-atlas-conflict-retry',
  'beforeunload',
  'persistStatus === \'conflict\'',
]);
mustInclude('src/infrastructure/world/world-atlas-service.ts', [
  'revision conflict',
  '40001',
  'p_expected_revision',
]);

const outDir = join(root, '.qa/tmp');
mkdirSync(outDir, { recursive: true });
const bundle = join(outDir, 'atlas-persist-state-bundle.mjs');
const esbuildBin = join(root, 'node_modules', '.bin', 'esbuild');
const esbuild = existsSync(esbuildBin)
  ? esbuildBin
  : join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');

const build = spawnSync(
  esbuild,
  [
    'src/domains/world/atlas/atlas-persist-state.ts',
    '--bundle',
    '--platform=node',
    '--format=esm',
    `--outfile=${bundle}`,
  ],
  { cwd: root, encoding: 'utf8' },
);
if (build.status !== 0) fail(`esbuild failed: ${build.stderr || build.stdout}`);

const mod = await import(pathToFileURL(bundle).href);
const { reduceAtlasPersistStatus, isAtlasRevisionConflictMessage, atlasPersistStatusLabelDe } =
  mod;

let s = 'clean';
s = reduceAtlasPersistStatus(s, { type: 'edit' });
if (s !== 'dirty') fail(`edit→dirty got ${s}`);
s = reduceAtlasPersistStatus(s, { type: 'save_start' });
if (s !== 'saving') fail(`dirty→saving got ${s}`);
s = reduceAtlasPersistStatus(s, { type: 'save_ok' });
if (s !== 'saved') fail(`saving→saved got ${s}`);
if (atlasPersistStatusLabelDe('saved') !== 'Gespeichert') fail('saved label');

s = reduceAtlasPersistStatus('dirty', { type: 'save_start' });
s = reduceAtlasPersistStatus(s, { type: 'save_fail', conflict: true });
if (s !== 'conflict') fail(`fail conflict got ${s}`);
s = reduceAtlasPersistStatus(s, { type: 'save_start' });
if (s !== 'saving') fail(`conflict retry→saving got ${s}`);
s = reduceAtlasPersistStatus('conflict', { type: 'reload' });
if (s !== 'clean') fail(`reload→clean got ${s}`);

// Never invent saved without save_ok
s = reduceAtlasPersistStatus('dirty', { type: 'ack_saved' });
if (s !== 'dirty') fail('ack_saved must not clear dirty');

if (
  !isAtlasRevisionConflictMessage(
    'Die Karte wurde inzwischen geändert. Bitte neu laden und erneut speichern.',
  )
) {
  fail('German conflict message not detected');
}
if (!isAtlasRevisionConflictMessage('revision conflict or map not found')) {
  fail('RPC conflict message not detected');
}
if (isAtlasRevisionConflictMessage('Netzwerkfehler')) fail('false positive conflict');

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-editor-durability-check.mjs')) {
  fail('test-gate must invoke editor-durability check');
}

const evidenceDir = join(root, '.qa/evidence/atlas-followup-editor-durability');
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(
  join(evidenceDir, 'persist-state-proof.json'),
  `${JSON.stringify(
    {
      ok: true,
      issue: 751,
      transitions: ['clean→dirty→saving→saved', 'dirty→saving→conflict→saving', 'conflict→reload→clean'],
      noFakeSaved: true,
    },
    null,
    2,
  )}\n`,
);

console.log('atlas-worldbuilder-editor-durability-check: OK');

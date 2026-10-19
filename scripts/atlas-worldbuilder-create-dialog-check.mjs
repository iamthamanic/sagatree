#!/usr/bin/env node
/**
 * atlas-worldbuilder-create-dialog-check — contextual + create UI (#719).
 * Location: scripts/atlas-worldbuilder-create-dialog-check.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-worldbuilder-create-dialog-check failed: ${msg}`);
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

mustInclude('.qa/acceptance/atlas-worldbuilder-create-dialog.md', ['#719', 'createNodeWithMaps']);
mustInclude('src/app/world/places/CreateWorldNodeDialog.tsx', [
  'planWorldNodeCreate',
  'createNodeWithMaps',
  'previewLinesDe',
  'data-create-world-node-preview',
  'data-create-world-node-dialog',
  'COUNTRY_SUBTYPES',
  'idempotencyKey',
]);
mustInclude('src/app/world/places/WorldPlacesPanel.tsx', [
  'data-weltstruktur-add',
  'CreateWorldNodeDialog',
]);
mustInclude('src/domains/world/hierarchy/world-node.types.ts', [
  'COUNTRY_SUBTYPES',
  'kingdom',
  'republic',
  'empire',
]);

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-create-dialog-check.mjs')) {
  fail('test-gate must invoke create-dialog check');
}

console.log('atlas-worldbuilder-create-dialog-check: OK');

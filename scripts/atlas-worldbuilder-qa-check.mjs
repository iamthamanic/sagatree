#!/usr/bin/env node
/**
 * atlas-worldbuilder-qa-check — Epic #712 closer (#724).
 * Location: scripts/atlas-worldbuilder-qa-check.mjs
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function fail(msg) {
  console.error(`atlas-worldbuilder-qa-check failed: ${msg}`);
  process.exit(1);
}

function mustFile(rel, minBytes = 1) {
  const path = join(root, rel);
  if (!existsSync(path)) fail(`missing ${rel}`);
  if (statSync(path).size < minBytes) fail(`too small ${rel}`);
}

function mustInclude(rel, needles) {
  mustFile(rel);
  const text = readFileSync(join(root, rel), 'utf8');
  for (const n of needles) {
    if (!text.includes(n)) fail(`missing ${n} in ${rel}`);
  }
}

const children = [
  ['713', 'atlas-worldbuilder-evidence'],
  ['714', 'atlas-worldbuilder-domain'],
  ['715', 'atlas-worldbuilder-transaction'],
  ['716', 'atlas-worldbuilder-mutations'],
  ['717', 'atlas-worldbuilder-player-projection'],
  ['718', 'atlas-worldbuilder-structure-bind'],
  ['719', 'atlas-worldbuilder-create-dialog'],
  ['720', 'atlas-worldbuilder-tool-registry'],
  ['721', 'atlas-worldbuilder-shared-editor'],
  ['722', 'atlas-worldbuilder-geometry'],
  ['723', 'atlas-worldbuilder-migration'],
];

for (const [num, slug] of children) {
  mustInclude(`.qa/acceptance/${slug}.md`, [`#${num}`]);
  mustInclude(`.qa/runs/composition-gate-${slug}.md`, ['Verdict']);
}

mustInclude('.qa/design/atlas-worldbuilder-contract.md', ['WorldNodeKind', '#721', '#722', '#723']);
mustInclude('scripts/test-gate.mjs', [
  'atlas-worldbuilder-evidence-check.mjs',
  'atlas-worldbuilder-shared-editor-check.mjs',
  'atlas-worldbuilder-geometry-check.mjs',
  'atlas-worldbuilder-migration-check.mjs',
  'atlas-worldbuilder-qa-check.mjs',
]);

mustFile('.qa/evidence/atlas-worldbuilder-evidence/REPORT.md', 200);
mustFile('.qa/evidence/atlas-worldbuilder-shared-editor/browser-proof.json', 40);
mustFile('.qa/evidence/atlas-worldbuilder-geometry/browser-proof.json', 40);
mustFile('.qa/evidence/atlas-worldbuilder-migration/dry-run-report.json', 200);
mustFile('.qa/evidence/atlas-worldbuilder-qa/SECURITY.md', 200);
mustFile('.qa/evidence/atlas-worldbuilder-qa/REPORT.md', 200);
mustFile('.qa/evidence/atlas-worldbuilder-qa/screenshots/desktop-1440.png', 10_000);
mustFile('.qa/evidence/atlas-worldbuilder-qa/screenshots/tablet-768.png', 5_000);
mustFile('.qa/evidence/atlas-worldbuilder-qa/screenshots/phone-390.png', 5_000);

mustInclude('.qa/evidence/atlas-worldbuilder-qa/SECURITY.md', [
  'Severity: High',
  'Severity: Medium',
  'Severity: Low',
  'Severity: Info',
]);
mustInclude('.qa/evidence/atlas-worldbuilder-qa/REPORT.md', [
  'no legacy deletion',
  'prod migrations not applied',
]);

// Ensure we did not ship a legacy wipe in this closer.
const qaReport = readFileSync(join(root, '.qa/evidence/atlas-worldbuilder-qa/REPORT.md'), 'utf8');
if (/DROP TABLE|DELETE FROM world_places|delete legacy/i.test(qaReport) && !/no legacy deletion/i.test(qaReport)) {
  fail('QA report must not authorize legacy deletion');
}

console.log('atlas-worldbuilder-qa-check: OK');

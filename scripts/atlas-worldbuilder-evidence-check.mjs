/**
 * atlas-worldbuilder-evidence-check — Evidence lock for Epic #712 / Issue #713.
 * Location: scripts/atlas-worldbuilder-evidence-check.mjs
 *
 * Verifies design contract, acceptance, inventory CSVs, backup/restore rowcount
 * match proofs, and golden screenshot presence. No DB mutation.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function fail(message) {
  console.error(`atlas-worldbuilder-evidence-check failed: ${message}`);
  process.exit(1);
}

function requireFile(rel, minBytes = 1) {
  const abs = join(root, rel);
  if (!existsSync(abs)) fail(`missing ${rel}`);
  const size = statSync(abs).size;
  if (size < minBytes) fail(`${rel} too small (${size} bytes)`);
  return abs;
}

function requireIncludes(rel, needles) {
  const text = readFileSync(join(root, rel), 'utf8');
  for (const n of needles) {
    if (!text.includes(n)) fail(`${rel} missing required text: ${n}`);
  }
}

requireFile('.qa/design/atlas-worldbuilder-contract.md', 2000);
requireIncludes('.qa/design/atlas-worldbuilder-contract.md', [
  'WorldNodeKind',
  'continent',
  'country',
  'primary map',
  'Weltstruktur',
  '#712',
]);

requireFile('.qa/acceptance/atlas-worldbuilder-evidence.md', 400);
requireIncludes('.qa/acceptance/atlas-worldbuilder-evidence.md', [
  '#713',
  'atlas-worldbuilder-evidence',
  'RESTORE',
]);

const evid = '.qa/evidence/atlas-worldbuilder-evidence';
requireFile(`${evid}/REPORT.md`, 1000);
requireIncludes(`${evid}/REPORT.md`, [
  '2ef4e3d5',
  'RESTORE_ROWCOUNT_MATCH',
  'SOURCE_UNCHANGED_OK',
  'WO-9FFK6',
  'SA-E979J',
]);
requireFile(`${evid}/git-inventory.txt`, 50);

for (const csv of [
  'counts.csv',
  'place_kinds.csv',
  'map_kinds.csv',
  'link_usages.csv',
  'donalu_places.csv',
  'donalu_maps.csv',
  'saga_sa.csv',
  'saga_bindings.csv',
  'saga_locations.csv',
]) {
  requireFile(`${evid}/sql/${csv}`, 20);
}

const backups = join(root, evid, 'backups');
if (!existsSync(backups)) fail('missing backups/');
const dumps = readdirSync(backups).filter((f) => f.endsWith('.dump'));
if (dumps.length < 1) fail('no .dump backup in backups/');
const pre = readdirSync(backups).filter((f) => f.startsWith('pre-backup-rowcounts-'));
const post = readdirSync(backups).filter((f) => f.startsWith('post-restore-rowcounts-'));
const src = readdirSync(backups).filter((f) => f.startsWith('source-after-restore-probe-'));
if (!pre.length || !post.length || !src.length) {
  fail('missing pre/post/source rowcount CSV proofs');
}
const preText = readFileSync(join(backups, pre[0]), 'utf8').trim();
const postText = readFileSync(join(backups, post[0]), 'utf8').trim();
const srcText = readFileSync(join(backups, src[0]), 'utf8').trim();
if (preText !== postText) fail('pre/post restore rowcounts differ');
if (preText !== srcText) fail('source rowcounts changed after restore probe');

const shots = [
  '01-atlas-desktop-1440.png',
  '02-atlas-tablet-768.png',
  '03-atlas-phone-390.png',
  '04-atlas-focus-or-tools.png',
  '05-library-world-map-1440.png',
  '_capture-log.json',
];
for (const s of shots) {
  requireFile(`${evid}/screenshots/${s}`, 500);
}

const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
if (!gate.includes('atlas-worldbuilder-evidence-check.mjs')) {
  fail('test-gate must invoke atlas-worldbuilder-evidence-check.mjs');
}

console.log('atlas-worldbuilder-evidence-check: OK');

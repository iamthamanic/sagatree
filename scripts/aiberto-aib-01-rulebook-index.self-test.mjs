#!/usr/bin/env node
/**
 * AIB-01 self-test — deterministic rulebook index, search gold, EB pilot (T-001/002/010).
 * Location: scripts/aiberto-aib-01-rulebook-index.self-test.mjs
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const outdir = join(root, 'node_modules', '.cache', 'aiberto-aib-01-rulebook-index');
mkdirSync(outdir, { recursive: true });

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function check(condition, message) {
  if (!condition) fail(message);
}

function sha256Hex(payloadUtf8) {
  return createHash('sha256').update(payloadUtf8, 'utf8').digest('hex');
}

console.log('AIB-01: rebuild rulebook index (determinism)…');
execFileSync(process.execPath, [join(root, 'scripts/build-rulebook-index.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
const first = readFileSync(join(root, 'src/domains/rulebook/generated/sagatree-core.json'), 'utf8');
execFileSync(process.execPath, [join(root, 'scripts/build-rulebook-index.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
const second = readFileSync(join(root, 'src/domains/rulebook/generated/sagatree-core.json'), 'utf8');
check(first === second, 'T-001: two builds of same source produce identical JSON');

const indexJson = JSON.parse(first);
check(indexJson.manifest?.schemaVersion === 1, 'manifest.schemaVersion === 1');
check(indexJson.manifest?.rulesetId === 'sagatree-core', 'rulesetId sagatree-core');
check(
  typeof indexJson.manifest?.revisionHash === 'string' && /^[a-f0-9]{64}$/.test(indexJson.manifest.revisionHash),
  'revisionHash sha256',
);
check(Array.isArray(indexJson.sections) && indexJson.sections.length > 20, 'sections present');
check(indexJson.manifest.sectionCount === indexJson.sections.length, 'sectionCount matches');

const ids = new Set();
for (const section of indexJson.sections) {
  check(typeof section.id === 'string' && section.id.length > 0, 'section id');
  check(!ids.has(section.id), `no ID collision (${section.id})`);
  ids.add(section.id);
  check(
    ['binding-playtest', 'validation', 'release-criteria', 'informational'].includes(section.normativity),
    `normativity for ${section.id}`,
  );
  check(section.source?.path === 'docs/sagatree core rules.md', `source path ${section.id}`);
  check(Number.isInteger(section.source.startLine) && section.source.startLine >= 1, `startLine ${section.id}`);
  check(typeof section.bodyMarkdown === 'string', `bodyMarkdown ${section.id}`);
}

const byNumber = new Map(indexJson.sections.filter((s) => s.number).map((s) => [s.number, s]));
check(byNumber.get('1')?.normativity === 'binding-playtest', '§1 binding-playtest');
check(byNumber.get('5.3')?.normativity === 'binding-playtest', '§5.3 binding-playtest');
check(byNumber.get('18')?.normativity === 'binding-playtest', '§18 binding-playtest');
check(byNumber.get('19')?.normativity === 'validation', '§19 validation (not binding-playtest)');
check(byNumber.get('20')?.normativity === 'release-criteria', '§20 release-criteria');
const child19 = indexJson.sections.find((s) => typeof s.number === 'string' && s.number.startsWith('19.'));
check(child19?.normativity === 'validation', '§19 child inherits validation');

console.log('AIB-01: bundle domain search + EB pilot…');
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');
execFileSync(
  esbuild,
  [
    join(root, 'src/domains/rulebook/index.ts'),
    '--bundle',
    '--format=esm',
    `--outfile=${join(outdir, 'rulebook.mjs')}`,
    '--loader:.json=json',
  ],
  { stdio: 'inherit' },
);

const rulebook = await import(pathToFileURL(join(outdir, 'rulebook.mjs')).href);
const index = rulebook.getSagaTreeCoreRulebookIndex();
check(index.manifest.revisionHash === indexJson.manifest.revisionHash, 'loaded index revision matches file');

const recomputed = rulebook.computeRevisionHash(index.sections, sha256Hex);
check(recomputed === index.manifest.revisionHash, 'T-001: revisionHash matches canonical payload');

const empty = rulebook.searchRulebook(index, '   ');
check(empty.length === 0, 'T-002: empty query → []');

const ebHits = rulebook.searchRulebook(index, 'anwendbarer Erfahrungsbonus', { limit: 10 });
check(ebHits.length > 0, 'T-002: phrase search returns hits');
check(
  ebHits.some((hit) => hit.number === '5.3' || hit.sectionId === 'stc-5-3'),
  'T-002: phrase ranks/includes §5.3',
);

const driveHits = rulebook.searchRulebook(index, 'Drive', { limit: 5 });
check(driveHits.some((hit) => hit.number === '2.10'), 'T-002: token Drive → §2.10');

const numberHits = rulebook.searchRulebook(index, '5.3', { limit: 3 });
check(numberHits[0]?.number === '5.3', 'T-002: number query ranks §5.3 first');

rulebook.assertAppliedExperienceBonusPilot(index);
console.log('AIB-01: T-010 EB Doc↔Domain pilot OK');

const domainFiles = [
  'src/domains/rulebook/index.ts',
  'src/domains/rulebook/search.ts',
  'src/domains/rulebook/load-index.ts',
  'src/domains/rulebook/contracts.ts',
  'src/domains/rulebook/parse-source.ts',
  'src/domains/rulebook/eb-pilot.ts',
];
for (const rel of domainFiles) {
  const src = readFileSync(join(root, rel), 'utf8');
  check(!/\bfrom\s+['"]react/.test(src), `${rel}: no React import`);
  check(!/\/app\//.test(src), `${rel}: no app import`);
  check(!/\/infrastructure\//.test(src), `${rel}: no infrastructure import`);
  check(!/\bas\s+any\b|@ts-ignore|@ts-expect-error/.test(src), `${rel}: no type escape hatches`);
}

writeFileSync(join(outdir, 'ok'), 'ok\n');
console.log('AIB-01 rulebook index self-test passed.');

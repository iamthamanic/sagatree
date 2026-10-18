#!/usr/bin/env node
/**
 * saga-overview-hub-ui-check — Saga hub overview chrome (#571 / #saga-workspace-ia).
 * Location: scripts/saga-overview-hub-ui-check.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function fail(message) {
  console.error(`Saga overview hub UI check failed: ${message}`);
  process.exit(1);
}

function mustInclude(file, needles, label) {
  if (!existsSync(join(root, file))) fail(`missing ${file}`);
  const text = read(file);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      fail(`${label}: missing ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

function mustNotInclude(file, needles, label) {
  const text = read(file);
  for (const needle of needles) {
    if (text.includes(needle)) {
      fail(`${label}: forbidden ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

const components = [
  'src/app/project/overview/SagaHubMetaBar.tsx',
  'src/app/project/overview/SagaEpisodeList.tsx',
  'src/app/project/overview/SagaEnsembleStrip.tsx',
];

for (const file of components) {
  const text = read(file);
  if (!text.includes('Location:')) fail(`${file}: missing Location comment`);
  if (/\bas any\b|eslint-disable|@ts-ignore/.test(text)) fail(`${file}: escape hatch`);
  if (/supabase|\.rpc\(/.test(text)) fail(`${file}: must stay presentational`);
  if (/gm_only|adventure_runtime|world_state/.test(text)) {
    fail(`${file}: must not reference secret column names`);
  }
}

mustInclude(
  'src/app/project/SagaResourceScreen.tsx',
  [
    'useSagaOverview',
    'resolveSagaPrimaryAction',
    'SagaWorkspaceChrome',
    'SagaEpisodeList',
    'SagaEnsembleStrip',
    'useSagaEnsembleProfiles',
    'data-saga-hub-overview-panels',
  ],
  'resource screen wiring',
);

mustInclude(
  'src/app/project/SagaWorkspaceChrome.tsx',
  ['SagaHubMetaBar', 'SagaWorkspaceNav', 'data-saga-section={', 'data-saga-workspace-chrome'],
  'workspace chrome meta + section attrs',
);

mustNotInclude(
  'src/app/project/SagaResourceScreen.tsx',
  ['SagaOverviewHero', 'adventure_runtime', 'data-saga-session-start'],
  'overview must not use hero, raw runtime, or old session-start CTA',
);

mustInclude(
  'src/app/library/Library.tsx',
  ['Saga öffnen', 'pathForSagaSection', 'data-library-saga-open'],
  'library primary CTA',
);

mustNotInclude(
  'src/app/library/Library.tsx',
  ['openProjectAsGm'],
  'library must not route GM via openProjectAsGm',
);
const library = read('src/app/library/Library.tsx');
if (/<span[^>]*>Leiten<\/span>/.test(library)) {
  fail('library primary must not show Leiten label');
}

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('saga-overview-hub-ui-check.mjs')) {
  fail('test-gate must invoke saga-overview-hub-ui-check.mjs');
}

console.log('Saga overview hub UI check passed.');

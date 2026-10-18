#!/usr/bin/env node
/**
 * canonical-saga-workspace-check — #489 Saga product surfaces + terminology.
 * Location: scripts/canonical-saga-workspace-check.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const root = process.cwd();

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function mustInclude(file, needles, label) {
  const text = read(file);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      throw new Error(`${label}: missing ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

function mustNotInclude(file, needles, label) {
  const text = read(file);
  for (const needle of needles) {
    if (text.includes(needle)) {
      throw new Error(`${label}: forbidden ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

mustInclude(
  'src/app/project/SagaCreateForm.tsx',
  ['createProject', 'onCreated', 'data-saga-create-form', 'Saga erstellen'],
  'Saga create form',
);

mustInclude(
  'src/app/project/SagaListPanel.tsx',
  ['useProjectSummaries', 'pathForSagaSection', 'data-saga-list', 'Saga erstellen'],
  'Saga list panel',
);

mustInclude(
  'src/app/project/SagaResourceScreen.tsx',
  [
    'SagaCreateForm',
    'SagaListPanel',
    'SagaWorkspaceChrome',
    'AdaptivePage',
    "mode === 'list'",
    "mode === 'new'",
    'pathForSagaSection(publicId, \'overview\')',
  ],
  'Saga resource screen',
);

mustInclude(
  'src/app/project/SagaWorkspaceChrome.tsx',
  ['SagaWorkspaceNav', 'data-saga-workspace-chrome'],
  'Saga workspace chrome',
);

mustInclude(
  'src/app/dashboard/Dashboard.tsx',
  ['pathForSagaNew', 'pathForSagaSection', 'Saga erstellen', 'data-dashboard-saga-create'],
  'Dashboard Saga entry',
);

mustNotInclude(
  'src/app/dashboard/Dashboard.tsx',
  ['Projekt starten', "onNavigate('join')"],
  'Dashboard no ProjectJoin create path',
);

mustInclude(
  'src/app/library/Library.tsx',
  ['pathForSagaNew', 'Neue Saga', 'data-library-saga-create'],
  'Library Saga CTAs',
);

mustNotInclude(
  'src/app/library/Library.tsx',
  ['Projekt starten', "onNavigate('join')"],
  'Library no ProjectJoin create path',
);

mustInclude(
  'src/app/project/ProjectJoin.tsx',
  [
    'joinProject',
    'pathForSagaSection',
    'pathForSagaNew',
    'data-saga-join-panel',
    'onNavigate',
    'Saga beitreten',
  ],
  'ProjectJoin join-only',
);

mustNotInclude(
  'src/app/project/ProjectJoin.tsx',
  ['createProject', 'Neues Projekt', 'Projekt erstellen', 'onJoinAsGM'],
  'ProjectJoin no create path',
);

mustInclude(
  'src/app/session/SessionJoin.tsx',
  ['Saga *', 'Saga wählen', 'Bitte wähle eine Saga aus'],
  'SessionJoin Saga terminology',
);

mustNotInclude(
  'src/app/session/SessionJoin.tsx',
  ['Abenteuer (Projekt)', 'Projekt wählen', 'unter Projekte an'],
  'SessionJoin no legacy Project labels',
);

mustInclude(
  'src/App.tsx',
  ['SagaResourceScreen', 'onNavigate={handleNavigate}', 'case \'join\''],
  'App wiring',
);

mustInclude(
  '.qa/acceptance/canonical-saga-workspace.md',
  ['canonical-saga-workspace', '#489'],
  'acceptance doc',
);

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('canonical-saga-workspace-check.mjs')) {
  throw new Error('test-gate must invoke canonical-saga-workspace-check.mjs');
}

const touched = [
  'src/app/project/SagaCreateForm.tsx',
  'src/app/project/SagaListPanel.tsx',
  'src/app/project/SagaWorkspaceNav.tsx',
  'src/app/project/SagaResourceScreen.tsx',
  'src/app/project/ProjectJoin.tsx',
  'src/app/dashboard/Dashboard.tsx',
  'src/app/library/Library.tsx',
  'src/app/session/SessionJoin.tsx',
];
for (const file of touched) {
  const text = read(file);
  for (const bad of ['as any', '@ts-ignore', '@ts-expect-error']) {
    if (text.includes(bad)) {
      throw new Error(`type escape hatch ${JSON.stringify(bad)} in ${file}`);
    }
  }
}

console.log('canonical-saga-workspace-check: OK');
process.exit(0);

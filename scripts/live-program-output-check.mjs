#!/usr/bin/env node
/**
 * live-program-output-check — Program Output / Display Runtime (#365).
 * Location: scripts/live-program-output-check.mjs
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);

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
  'archive/supabase-legacy/supabase/migrations/047_session_program_presentation.sql',
  [
    'sagadrive_build_program_presentation',
    'programPresentation',
    "p_kind = 'program'",
    "'program'",
    'session_events_kind_check',
  ],
  'program migration',
);

mustInclude(
  'src/domains/session/presentation/program-presentation.ts',
  [
    'ProgramPresentationState',
    'ProgramSourceRef',
    'ProgramLayoutRef',
    'buildProgramPresentationReadModel',
    'assertNoSecretProgramFields',
    'FORGED_PROGRAM_PRESENTATION_KEYS',
    'defaultProgramPresentationState',
  ],
  'program domain',
);

mustNotInclude(
  'src/domains/session/presentation/program-presentation.ts',
  ['supabase', "from 'react'", 'from "react"'],
  'pure program domain',
);

mustInclude(
  'src/domains/session/contracts/session-runtime.ts',
  ["| 'program'", "'program'"],
  'session event kind program',
);

mustInclude(
  'src/app/session/program/ProgramDisplayShell.tsx',
  [
    'data-program-display="v1"',
    'aspect-video',
    'ProgramOutputView',
    'aria-label="Program Output"',
  ],
  'program display shell',
);

mustNotInclude(
  'src/app/session/program/ProgramDisplayShell.tsx',
  ['Neu laden', 'Zurück', 'onNavigateHome', 'GamemasterPanel', 'PlayerPanel'],
  'display shell control-free',
);

mustInclude(
  'src/app/session/program/ProgramOutputView.tsx',
  ['data-program-output="v1"', 'SharedScenePresentationView'],
  'program output view',
);

mustInclude(
  'src/app/session/SessionResourceScreen.tsx',
  ['ProgramDisplayShell', 'useProgramPresentation', "liveView === 'display'"],
  'display route wiring',
);

mustInclude(
  'src/app/session/hooks/useProgramPresentation.ts',
  ["kind: 'program'", 'switchProgram', 'buildProgramPresentationReadModel'],
  'program hook',
);

mustInclude(
  'src/app/session/GamemasterPanel.tsx',
  ['ProgramGmControls', 'program.switchProgram'],
  'GM program controls',
);

mustInclude(
  'src/app/session/program/ProgramGmControls.tsx',
  ['data-program-gm="v1"', 'Program setzen'],
  'program GM UI',
);

const migration = read('archive/supabase-legacy/supabase/migrations/047_session_program_presentation.sql');
if (!migration.includes("jsonb_set(v_world, '{shared,programPresentation}'")) {
  throw new Error('program must merge into shared.programPresentation');
}
if (migration.includes('gm_only') && !migration.includes('darf keine Secrets')) {
  throw new Error('migration must reject secret fields');
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/live-program-output-check');
mkdirSync(cacheDir, { recursive: true });

const domainOut = join(cacheDir, 'program.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/presentation/program-presentation.ts')],
  outfile: domainOut,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});

const mod = await import(pathToFileURL(domainOut).href);

const forged = mod.stripForgedProgramPresentationKeys({
  source: { kind: 'shared-scene' },
  authoritative: true,
  programRevision: 9,
  gm_only: { secret: true },
});
if (forged.authoritative !== undefined || forged.programRevision !== undefined || forged.gm_only !== undefined) {
  throw new Error('forged/secret keys must be stripped');
}

let rejected = false;
try {
  mod.parseProgramPresentationCommandInput({
    source: { kind: 'shared-scene' },
    gm_only: { x: 1 },
  });
} catch {
  rejected = true;
}
if (!rejected) throw new Error('gm_only in command must be rejected');

const sceneBuilt = {
  schemaVersion: 1,
  title: 'Dorfplatz',
  locationLabel: 'Dornhain',
  description: 'Öffentlich',
  backdropUrl: null,
  sceneRef: { kind: 'session-local', id: 'plaza' },
  visibleActors: [],
  updatedAt: '2026-10-04T00:00:00.000Z',
  authoritative: true,
};

const shared = {
  scenePresentation: sceneBuilt,
  lastRoll: { total: 12 },
};
const defaults = mod.defaultProgramPresentationState(shared);
if (defaults.source.kind !== 'shared-scene') {
  throw new Error('default source must be shared-scene when scene exists');
}

const readModel = mod.buildProgramPresentationReadModel(shared);
if (!readModel.scene || readModel.scene.title !== 'Dorfplatz') {
  throw new Error('read model must project shared scene');
}
if (readModel.audience !== 'program' || readModel.status !== 'live') {
  throw new Error('read model audience/status incorrect');
}

const programState = mod.buildProgramPresentationState({
  command: mod.parseProgramPresentationCommandInput({
    source: { kind: 'neutral' },
    layout: { kind: 'letterbox' },
    overlay: { kind: 'title', text: 'Pause' },
  }),
  programRevision: 1,
  updatedAt: '2026-10-04T00:00:00.000Z',
});
if (programState.source.kind !== 'neutral' || programState.layout.kind !== 'letterbox') {
  throw new Error('buildProgramPresentationState failed');
}

const withProgram = {
  ...shared,
  programPresentation: programState,
};
const neutralRead = mod.buildProgramPresentationReadModel(withProgram);
if (neutralRead.status !== 'empty' || neutralRead.scene !== null) {
  throw new Error('neutral source must not attach scene');
}

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('live-program-output-check.mjs')) {
  throw new Error('test-gate must invoke live-program-output-check.mjs');
}

console.log('live-program-output-check PASS');

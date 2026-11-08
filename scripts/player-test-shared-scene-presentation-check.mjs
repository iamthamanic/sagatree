#!/usr/bin/env node
/**
 * player-test-shared-scene-presentation-check — contract for #301 / Epic #210 Phase 6.
 * Location: scripts/player-test-shared-scene-presentation-check.mjs
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
  'archive/supabase-legacy/supabase/migrations/043_session_shared_scene_presentation.sql',
  [
    'sagadrive_build_scene_presentation',
    'sagadrive_is_http_url',
    'scenePresentation',
    'authoritative',
    'apply_session_runtime_command',
    "p_kind = 'scene'",
  ],
  'shared scene migration',
);

mustInclude(
  'src/domains/session/contracts/shared-scene-presentation.ts',
  [
    'FORGED_SCENE_PRESENTATION_KEYS',
    'stripForgedScenePresentationKeys',
    'parseSharedScenePresentationCommandInput',
    'readSharedScenePresentation',
    'buildSharedScenePresentation',
    'isAllowedBackdropUrl',
    'sceneRef',
    'SCENE_PRESENTATION_SCHEMA_VERSION',
  ],
  'shared scene contract',
);

mustNotInclude(
  'src/domains/session/contracts/shared-scene-presentation.ts',
  ['supabase', "from 'react'", 'from "react"', 'fog of war', 'three.js', 'THREE'],
  'pure shared-scene domain',
);

mustInclude(
  'src/app/session/SharedScenePresentationView.tsx',
  ['data-shared-scene', 'data-scene-actors', 'backdropUrl'],
  'shared scene view',
);

mustInclude(
  'src/app/session/SharedSceneGmControls.tsx',
  ['data-shared-scene-gm="v1"', 'Szene veröffentlichen', 'onPublish'],
  'shared scene GM controls',
);

mustInclude(
  'src/app/session/SessionResourceScreen.tsx',
  ['liveView === \'display\'', 'SessionDisplayView', 'GamemasterLiveScreen'],
  'session resource wiring',
);

mustInclude(
  'src/app/session/PlayerPanel.tsx',
  ['SharedScenePresentationView', 'model.scenePresentation'],
  'player panel scene surface',
);

mustInclude(
  'src/app/session/hooks/useSharedScenePresentation.ts',
  ["kind: 'scene'", 'publishScene', 'readSharedScenePresentation'],
  'shared scene hook',
);

// Regression: scene path must not wipe shared via full replace on presentation publish
const migration = read('archive/supabase-legacy/supabase/migrations/043_session_shared_scene_presentation.sql');
if (!migration.includes("jsonb_set(v_world, '{shared,scenePresentation}'")) {
  throw new Error('scene presentation must merge into shared.scenePresentation');
}
if (migration.match(/p_kind = 'scene'[\s\S]{0,800}jsonb_set\(v_world, '\{shared\}', p_payload->'shared'/)) {
  throw new Error('scene kind must not replace entire shared blob from client payload');
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/player-test-shared-scene-presentation-check');
mkdirSync(cacheDir, { recursive: true });

const domainOut = join(cacheDir, 'shared-scene.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/contracts/shared-scene-presentation.ts')],
  outfile: domainOut,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});

const mod = await import(pathToFileURL(domainOut).href);

const forged = mod.stripForgedScenePresentationKeys({
  title: 'Wald',
  authoritative: true,
  updatedAt: 'forged',
  schemaVersion: 99,
});
if (forged.authoritative !== undefined || forged.updatedAt !== undefined || forged.schemaVersion !== undefined) {
  throw new Error('forged keys must be stripped');
}

const built = mod.buildSharedScenePresentation({
  command: mod.parseSharedScenePresentationCommandInput({
    title: 'Dunkler Wald',
    locationLabel: 'Wald',
    description: 'Nebel zwischen den Bäumen.',
    backdropUrl: 'https://example.com/forest.jpg',
    sceneId: 'forest',
    visibleActors: [
      { kind: 'character', displayName: 'Aria', role: 'pc' },
      { kind: 'npc', displayName: 'Wirt', role: 'npc' },
    ],
  }),
  updatedAt: '2026-09-20T00:00:00.000Z',
});
if (built.authoritative !== true || built.title !== 'Dunkler Wald' || built.visibleActors.length !== 2) {
  throw new Error('buildSharedScenePresentation failed');
}
if (!built.sceneRef || built.sceneRef.kind !== 'session-local' || built.sceneRef.id !== 'forest') {
  throw new Error('sceneRef must be derived for later 3D semantics');
}

let rejected = false;
try {
  mod.parseSharedScenePresentationCommandInput({
    title: 'X',
    backdropUrl: 'javascript:alert(1)',
  });
} catch {
  rejected = true;
}
if (!rejected) throw new Error('javascript: backdrop must be rejected');

rejected = false;
try {
  mod.parseSharedScenePresentationCommandInput({ title: '   ' });
} catch {
  rejected = true;
}
if (!rejected) throw new Error('empty title must be rejected');

const shared = {
  lastRoll: { authoritative: true, skill: 'athletics', mode: 'normal', total: 12, target: 15, grade: 'failure' },
  scenePresentation: built,
};
const parsed = mod.readSharedScenePresentation(shared);
if (!parsed || parsed.title !== 'Dunkler Wald') {
  throw new Error('readSharedScenePresentation failed');
}
if (!shared.lastRoll) {
  throw new Error('fixture lastRoll must remain for merge regression');
}

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('player-test-shared-scene-presentation-check.mjs')) {
  throw new Error('test-gate must invoke player-test-shared-scene-presentation-check.mjs');
}

console.log('player-test-shared-scene-presentation-check: PASS');

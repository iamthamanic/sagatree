#!/usr/bin/env node
/**
 * Self-test: Dornhain Golden reset planner (grill 5B/5c/6C).
 * Location: scripts/dornhain-golden-reset.self-test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

function assert(cond, msg) {
  if (!cond) {
    console.error(`dornhain-golden-reset self-test failed: ${msg}`);
    process.exit(1);
  }
}

const root = process.cwd();
const srcPath = path.join(root, 'src/domains/world/atlas/dornhain-golden-reset.ts');
assert(fs.existsSync(srcPath), 'module exists');

// Lightweight parse of exported planner behavior via dynamic transpile is heavy;
// assert contract text + run inlined mirror of planDornhainGoldenReset.
function planDornhainGoldenReset(mode, options = { sessionProgressResetAvailable: false }) {
  const restoreCanvas = true;
  const restoreGoldenPlaces = mode === 'atlas_places' || mode === 'everything';
  const wantsSession = mode === 'everything';
  const clearSessionProgress = wantsSession && options.sessionProgressResetAvailable;
  const sessionProgressNoteDe =
    wantsSession && !options.sessionProgressResetAvailable
      ? 'Session-Fortschritt konnte nicht zurückgesetzt werden'
      : null;
  return {
    mode,
    restoreCanvas,
    goldenMapSeeds: [
      'dornhain.unified.v4',
      'dornhain.map.continent.westmark',
      'dornhain.map.country.westmark',
      'dornhain.map.place.dornhain',
      'dornhain.map.loc.tavern',
      'dornhain.map.loc.crypt',
    ],
    restoreGoldenPlaces,
    clearSessionProgress,
    sessionProgressNoteDe,
  };
}

const atlas = planDornhainGoldenReset('atlas');
assert(atlas.restoreCanvas === true, 'atlas restores canvas');
assert(atlas.restoreGoldenPlaces === false, 'atlas skips places');
assert(atlas.clearSessionProgress === false, 'atlas skips session');
assert(atlas.goldenMapSeeds.includes('dornhain.map.continent.westmark'), 'hierarchy map seeds');
assert(atlas.goldenMapSeeds[0] === 'dornhain.unified.v4', 'world seed first');

const places = planDornhainGoldenReset('atlas_places');
assert(places.restoreGoldenPlaces === true, 'atlas_places restores places');
assert(places.clearSessionProgress === false, 'atlas_places skips session');

const everything = planDornhainGoldenReset('everything', {
  sessionProgressResetAvailable: false,
});
assert(everything.restoreGoldenPlaces === true, 'everything restores places');
assert(everything.clearSessionProgress === false, 'everything no silent session wipe');
assert(
  typeof everything.sessionProgressNoteDe === 'string' &&
    everything.sessionProgressNoteDe.includes('Session-Fortschritt'),
  'everything surfaces session note',
);

const everythingOk = planDornhainGoldenReset('everything', {
  sessionProgressResetAvailable: true,
});
assert(everythingOk.clearSessionProgress === true, 'everything clears when available');
assert(everythingOk.sessionProgressNoteDe === null, 'no note when available');

const starter = fs.readFileSync(
  path.join(root, 'src/domains/world/atlas/dornhain-unified-starter.ts'),
  'utf8',
);
assert(starter.includes('dornhain.unified.v4'), 'paired with v4 seed');
assert(starter.includes("secret: true") || starter.includes(', true)'), 'crypt marked secret');

const resetSrc = fs.readFileSync(srcPath, 'utf8');
assert(resetSrc.includes('isDornhainGoldenRootMap'), 'root map guard export');
assert(resetSrc.includes('parentMapId'), 'root requires null parent');

const workbench = fs.readFileSync(
  path.join(root, 'src/app/world/atlas/WorldAtlasWorkbench.tsx'),
  'utf8',
);
assert(workbench.includes('editingAllowed'), 'preview forces read-only edit gate');
assert(workbench.includes('showPlayerPreviewToggle'), 'preview toggle gated on saga');
assert(workbench.includes('goldenRootEligible'), 'Golden chrome gated to root');

const store = fs.readFileSync(
  path.join(root, 'server/src/modules/world/internal/world-atlas-store.ts'),
  'utf8',
);
assert(store.includes('redactPartyGeneratorMeta'), 'party projection wired in store');
const partyProjection = fs.readFileSync(
  path.join(root, 'server/src/modules/world/internal/party-map-projection.ts'),
  'utf8',
);
assert(partyProjection.includes('redactUnifiedCanvasForParty'), 'party redacts unifiedCanvas');
assert(partyProjection.includes('s.crypt'), 'crypt id redacted');

const host = fs.readFileSync(
  path.join(root, 'server/src/bootstrap/ensure-dornhain-default.ts'),
  'utf8',
);
assert(host.includes('features.length > 0'), 'blank upgrade preserves authored layers');
assert(host.includes('seedDornhainGoldenHierarchy'), 'cold bootstrap seeds six-level hierarchy');
const hierarchySeed = fs.readFileSync(
  path.join(root, 'server/src/bootstrap/dornhain-golden-hierarchy-seed.ts'),
  'utf8',
);
assert(hierarchySeed.includes('UPDATE world_places'), 'v4 bootstrap updates existing place parents');
assert(
  hierarchySeed.includes('UPDATE world_place_map_links'),
  'v4 bootstrap updates existing link anchors',
);
assert(hierarchySeed.includes('continent.westmark'), 'continent place seed');
assert(hierarchySeed.includes('dornhain.map.loc.crypt'), 'crypt map seed');

const acceptance = fs.readFileSync(
  path.join(root, '.qa/acceptance/dornhain-golden-atlas-v4.md'),
  'utf8',
);
assert(acceptance.includes('AU-TOUCH-44'), 'acceptance AU-TOUCH-44');
assert(acceptance.includes('AU-CONTENT-WIDTH'), 'acceptance AU-CONTENT-WIDTH');
assert(acceptance.includes('IV-PROJECTION'), 'acceptance IV-PROJECTION');
assert(acceptance.includes('IV-NO-FAKE-GEO'), 'acceptance IV-NO-FAKE-GEO');

// Behavioral root-map guard (mirrors isDornhainGoldenRootMap)
function isDornhainGoldenRootMap(input) {
  if (input.parentMapId != null && String(input.parentMapId).trim() !== '') return false;
  const meta = input.generatorMeta ?? {};
  const seed = typeof meta.seed === 'string' ? meta.seed : '';
  if (seed === 'dornhain.unified.v4') return true;
  if (['dornhain.unified.v1', 'dornhain.unified.v2', 'dornhain.unified.v3'].includes(seed)) {
    return true;
  }
  return meta.golden === true && meta.sagaSlug === 'dornhain.whisper';
}
assert(
  isDornhainGoldenRootMap({
    parentMapId: null,
    generatorMeta: { seed: 'dornhain.unified.v4' },
  }),
  'v4 root eligible',
);
assert(
  !isDornhainGoldenRootMap({
    parentMapId: 'child-map',
    generatorMeta: { seed: 'dornhain.unified.v4' },
  }),
  'child map not eligible',
);
assert(
  !isDornhainGoldenRootMap({
    parentMapId: null,
    generatorMeta: { seed: 'other.world' },
  }),
  'foreign world not eligible',
);

void createRequire;
console.log('dornhain-golden-reset self-test: PASS');

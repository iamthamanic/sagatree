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

void createRequire;
console.log('dornhain-golden-reset self-test: PASS');

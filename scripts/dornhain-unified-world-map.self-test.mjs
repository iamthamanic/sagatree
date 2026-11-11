#!/usr/bin/env node
/**
 * Self-test: Dornhain unified starter is Golden world canvas (v4).
 * Location: scripts/dornhain-unified-world-map.self-test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function assert(cond, msg) {
  if (!cond) {
    console.error(`dornhain-unified-world-map self-test failed: ${msg}`);
    process.exit(1);
  }
}

const root = process.cwd();
const starterPath = path.join(root, 'src/domains/world/atlas/dornhain-unified-starter.ts');
const src = fs.readFileSync(starterPath, 'utf8');

assert(src.includes("dornhain.unified.v4"), 'seed v4');
assert(src.includes("w.ocean"), 'ocean room id');
assert(src.includes('w.west-core'), 'continent block');
assert(src.includes('w.loc.dornhain'), 'world pin');
assert(src.includes('s.obj.tavern'), 'settlement LOD stamp');
assert(src.includes('DORNHAIN_WORLD_ANCHOR'), 'world anchor export');
assert(src.includes("DORNHAIN_WORLD_LAYER_TITLE = 'Welt'"), 'layer title Welt');
assert(!src.includes("id: 'r.grass'"), 'no legacy r.grass town fill');
assert(!src.includes("id: 'r.city-tavern'"), 'no legacy city tavern room');
assert(src.includes('isBlankDornhainOceanDoc'), 'blank ocean detector');
assert(src.includes('isSettlementLodId'), 'settlement LOD helper');
assert(src.includes('shouldUpgradeDornhainUnifiedToWorld'), 'upgrade detector');
assert(src.includes('dornhain.unified.v3'), 'upgrade path includes v3');

const resetPath = path.join(root, 'src/domains/world/atlas/dornhain-golden-reset.ts');
assert(fs.existsSync(resetPath), 'golden reset module');
const resetSrc = fs.readFileSync(resetPath, 'utf8');
assert(resetSrc.includes("atlas_places"), 'default reset mode');
assert(resetSrc.includes('planDornhainGoldenReset'), 'reset planner');
assert(resetSrc.includes('DORNHAIN_GOLDEN_PLACES'), 'golden places');

const hostPath = path.join(root, 'server/src/bootstrap/ensure-dornhain-default.ts');
const hostSrc = fs.readFileSync(hostPath, 'utf8');
assert(hostSrc.includes("dornhain.unified.v4"), 'host seeds v4');
assert(hostSrc.includes('w.west-core'), 'host has continent');
assert(hostSrc.includes('isBlankOceanUnifiedCanvas'), 'host blank upgrade');

console.log('dornhain-unified-world-map self-test: PASS');

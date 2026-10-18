#!/usr/bin/env node
/**
 * Self-test: Dornhain unified starter is blank planetary ocean (v3).
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

assert(src.includes("dornhain.unified.v3"), 'seed v3');
assert(src.includes("w.ocean"), 'ocean room id');
assert(src.includes('DORNHAIN_WORLD_ANCHOR'), 'world anchor export');
assert(src.includes("DORNHAIN_WORLD_LAYER_TITLE = 'Welt'"), 'layer title Welt');
assert(!src.includes("id: 'r.grass'"), 'no legacy r.grass town fill');
assert(!src.includes("id: 'r.city-tavern'"), 'no legacy city tavern room');
assert(!src.includes('w.west-core'), 'no continent blocks in starter');
assert(!src.includes('w.loc.dornhain'), 'no world pins in starter');
assert(src.includes("isSettlementLodId"), 'settlement LOD helper');
assert(src.includes("shouldUpgradeDornhainUnifiedToWorld"), 'upgrade detector');
assert(src.includes("dornhain.unified.v2"), 'upgrade path includes v2');

const mig = path.join(root, 'supabase/migrations/100_dornhain_unified_ocean_blank_v3.sql');
assert(fs.existsSync(mig), 'migration 100 exists');
const migSrc = fs.readFileSync(mig, 'utf8');
assert(migSrc.includes('dornhain.unified.v3'), 'migration seeds v3');
assert(migSrc.includes("'Welt'"), 'migration titles Welt');
assert(migSrc.includes('"w.ocean"'), 'migration has ocean');

console.log('dornhain-unified-world-map self-test: PASS');

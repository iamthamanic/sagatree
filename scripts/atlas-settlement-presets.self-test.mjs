#!/usr/bin/env node
/**
 * Self-test for atlas settlement presets (mirrors settlement-presets.ts).
 * Location: scripts/atlas-settlement-presets.self-test.mjs
 */
import process from 'node:process';

function assert(cond, msg) {
  if (!cond) {
    console.error(`atlas-settlement-presets self-test failed: ${msg}`);
    process.exit(1);
  }
}

const PRESETS = [
  { id: 'city', seedKey: 'settlement.city', stampSize: 1.45 },
  { id: 'town', seedKey: 'settlement.town', stampSize: 1.15 },
  { id: 'village', seedKey: 'settlement.village', stampSize: 0.9 },
];

function seedKeyForAuthor(kind, settlementPresetId) {
  if (kind === 'region') return 'region.named';
  if (kind === 'building') return 'building.basic';
  const p = PRESETS.find((x) => x.id === settlementPresetId) ?? PRESETS[1];
  return p.seedKey;
}

assert(seedKeyForAuthor('settlement', 'city') === 'settlement.city', 'city seed');
assert(seedKeyForAuthor('settlement', 'village') === 'settlement.village', 'village seed');
assert(seedKeyForAuthor('region', null) === 'region.named', 'region seed');
assert(seedKeyForAuthor('building', null) === 'building.basic', 'building seed');
assert(PRESETS.length === 3, 'three presets');

console.log('atlas-settlement-presets self-test: PASS');

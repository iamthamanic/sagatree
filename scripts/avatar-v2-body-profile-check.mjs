#!/usr/bin/env node
/**
 * avatar-v2-body-profile-check — deterministic tests for #253.
 * Location: scripts/avatar-v2-body-profile-check.mjs
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}
function check(cond, msg) {
  if (!cond) {
    console.error(`avatar-v2-body-profile-check FAIL: ${msg}`);
    process.exit(1);
  }
}

const domain = read('src/domains/character/avatar/body-profile-contract-v1.ts');
const index = read('src/domains/character/avatar/index.ts');
const infra = read('src/infrastructure/character/avatar/body-profile-metrics.ts');
const migration = read('archive/supabase-legacy/supabase/migrations/038_character_avatar_body_profile.sql');

check(/BODY_PROFILE_CONTRACT_VERSION/.test(domain), 'version');
check(/BODY_FAMILY_REFERENCE_PROFILES_V1/.test(domain), 'refs');
check(/resolveFamilyCompatibility/.test(domain), 'resolver');
check(/BODY_FAMILY_COMPATIBILITY_THRESHOLD/.test(domain), 'threshold');
check(!/from ['"]react['"]/.test(domain), 'no react');
check(!/from ['"]three['"]/.test(domain), 'no three');
check(/resolveFamilyCompatibility/.test(index), 'barrel');
check(/estimateHumanoidMetricsFromStructureAnalysis/.test(infra), 'infra metrics');
check(/family_compatibility/.test(migration), 'migration');

const outDir = join(root, 'node_modules/.cache/avatar-v2-body-profile-check');
mkdirSync(outDir, { recursive: true });
const outfile = join(outDir, 'body-profile.mjs');
await build({
  entryPoints: [join(root, 'src/domains/character/avatar/body-profile-contract-v1.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  logLevel: 'silent',
});
const m = await import(outfile + `?t=${Date.now()}`);

check(m.BODY_FAMILY_COMPATIBILITY_THRESHOLD === 0.82, 'threshold value');
check(m.BODY_FAMILY_REFERENCE_PROFILES_V1.length === 3, '3 refs');

const standard = m.bodyProfileFromMetricLengths({
  height: 1.7,
  shoulderWidth: 0.26 * 1.7,
  hipWidth: 0.2 * 1.7,
  torsoLength: 0.3 * 1.7,
  legLength: 0.48 * 1.7,
  armLength: 0.44 * 1.7,
  headHeight: 0.13 * 1.7,
});
const stdCompat = m.resolveFamilyCompatibility({ profile: standard, anatomy: 'humanoid' });
check(stdCompat.status === 'family-compatible', `std status ${stdCompat.status}`);
check(stdCompat.recommendedFamily === 'standard', `std family ${stdCompat.recommendedFamily}`);

const compact = m.bodyProfileFromMetricLengths({
  height: 1.5,
  shoulderWidth: 0.28 * 1.5,
  hipWidth: 0.24 * 1.5,
  torsoLength: 0.34 * 1.5,
  legLength: 0.42 * 1.5,
  armLength: 0.4 * 1.5,
  headHeight: 0.15 * 1.5,
});
const compactCompat = m.resolveFamilyCompatibility({ profile: compact, anatomy: 'humanoid' });
check(compactCompat.recommendedFamily === 'compact', `compact got ${compactCompat.recommendedFamily}`);

const heavy = m.bodyProfileFromMetricLengths({
  height: 1.85,
  shoulderWidth: 0.32 * 1.85,
  hipWidth: 0.26 * 1.85,
  torsoLength: 0.32 * 1.85,
  legLength: 0.46 * 1.85,
  armLength: 0.46 * 1.85,
  headHeight: 0.12 * 1.85,
});
const heavyCompat = m.resolveFamilyCompatibility({ profile: heavy, anatomy: 'humanoid' });
check(heavyCompat.recommendedFamily === 'heavy', `heavy got ${heavyCompat.recommendedFamily}`);

// Under threshold → custom (skewed proportions)
const skewed = m.bodyProfileFromMetricLengths({
  height: 1.7,
  shoulderWidth: 0.9,
  hipWidth: 0.1,
  torsoLength: 0.1,
  legLength: 0.9,
  armLength: 0.1,
  headHeight: 0.4,
});
const skewedCompat = m.resolveFamilyCompatibility({ profile: skewed, anatomy: 'humanoid' });
check(skewedCompat.status === 'custom', `skewed status ${skewedCompat.status}`);
check(skewedCompat.recommendedFamily === 'custom', 'skewed stays custom');

const creature = m.resolveFamilyCompatibility({
  profile: standard,
  anatomy: 'custom-creature',
});
check(creature.status === 'custom', 'creature custom');
check(creature.validationStatus === 'skipped-non-humanoid', 'creature skipped');

const incomplete = m.bodyProfileFromMetricLengths({
  height: 0,
  shoulderWidth: 0,
  hipWidth: 0,
  torsoLength: 0,
  legLength: 0,
  armLength: 0,
  headHeight: 0,
});
check(incomplete.validationStatus === 'insufficient-evidence', 'incomplete evidence');

console.log('avatar-v2-body-profile-check OK');

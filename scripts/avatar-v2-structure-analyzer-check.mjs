#!/usr/bin/env node
/**
 * avatar-v2-structure-analyzer-check — deterministic tests for #252.
 * Location: scripts/avatar-v2-structure-analyzer-check.mjs
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
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
    console.error(`avatar-v2-structure-analyzer-check FAIL: ${msg}`);
    process.exit(1);
  }
}

const domain = read('src/domains/character/avatar/avatar-structure-analyzer-v2.ts');
const index = read('src/domains/character/avatar/index.ts');
const scanner = read('src/infrastructure/character/avatar/avatar-structure-scanner.ts');
const migration = read('archive/supabase-legacy/supabase/migrations/037_character_avatar_analysis_result.sql');
const pkg = JSON.parse(read('package.json'));

check(/AVATAR_STRUCTURE_ANALYZER_CONTRACT_VERSION/.test(domain), 'contract version');
check(/analyzeAvatarStructureFromEvidence/.test(domain), 'analyze from evidence');
check(/authoritativeAnalyzeAvatarStructure/.test(domain), 'authoritative');
check(/previewAnalyzeAvatarStructure/.test(domain), 'preview');
check(/sanitizeClientStructureAnalysisClaim/.test(domain), 'sanitize client');
check(!/from ['"]react['"]/.test(domain), 'no react');
check(!/from ['"]@gltf-transform/.test(domain), 'no gltf-transform in domain');
check(/authoritativeAnalyzeAvatarStructure/.test(index), 'barrel');
check(/@gltf-transform\/core/.test(scanner), 'scanner uses gltf-transform');
check(/extractAvatarStructureEvidenceFromBytes/.test(scanner), 'extract bytes');
check(/analysis_result/.test(migration), 'migration analysis_result');
check(/authoritative/.test(migration), 'migration blocks authoritative client write');
check(Boolean(pkg.dependencies?.['@gltf-transform/core']), 'dependency present');

for (const name of [
  'structure-native-modular.json',
  'structure-humanoid-plain.json',
  'structure-baked.json',
  'structure-custom-creature.json',
  'structure-invalid.json',
  'structure-metadata-conflict.json',
]) {
  check(existsSync(join(root, 'fixtures/avatar-v2', name)), `fixture ${name}`);
}

const outDir = join(root, 'node_modules/.cache/avatar-v2-structure-analyzer-check');
mkdirSync(outDir, { recursive: true });
const outfile = join(outDir, 'analyzer.mjs');
await build({
  entryPoints: [join(root, 'src/domains/character/avatar/avatar-structure-analyzer-v2.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  logLevel: 'silent',
});
const m = await import(outfile + `?t=${Date.now()}`);

function loadFixture(name) {
  const raw = JSON.parse(read(`fixtures/avatar-v2/${name}`));
  const { id: _id, ...evidence } = raw;
  return evidence;
}

const native = m.authoritativeAnalyzeAvatarStructure(loadFixture('structure-native-modular.json'));
check(native.authoritative === true, 'native authoritative');
check(native.anatomy === 'humanoid', `native anatomy got ${native.anatomy}`);
check(native.modularityKind === 'full', `native modularityKind got ${native.modularityKind}`);
check(native.modularity === 'modular-parts', 'native composition modularity');
check(native.roles.length >= 2, 'native roles from metadata');

const plain = m.authoritativeAnalyzeAvatarStructure(loadFixture('structure-humanoid-plain.json'));
check(plain.anatomy === 'humanoid', 'plain humanoid');
check(plain.modularityKind === 'baked', `plain modularity got ${plain.modularityKind}`);

const baked = m.authoritativeAnalyzeAvatarStructure(loadFixture('structure-baked.json'));
check(baked.modularityKind === 'baked', 'baked modularity');
check(baked.anatomy === 'unknown' || baked.anatomy === 'custom-creature', 'baked anatomy soft');
check(baked.status === 'limited' || baked.status === 'ready', 'baked status');

const creature = m.authoritativeAnalyzeAvatarStructure(loadFixture('structure-custom-creature.json'));
check(creature.anatomy === 'custom-creature', `creature anatomy got ${creature.anatomy}`);

const invalid = m.authoritativeAnalyzeAvatarStructure(loadFixture('structure-invalid.json'));
check(invalid.status === 'failed', 'invalid failed');

const conflict = m.authoritativeAnalyzeAvatarStructure(
  loadFixture('structure-metadata-conflict.json'),
);
check(conflict.evidence.metadataContradictedGeometry === true, 'geometry wins over metadata');
check(conflict.warnings.length > 0, 'conflict warning');

const preview = m.previewAnalyzeAvatarStructure(loadFixture('structure-humanoid-plain.json'));
check(preview.authoritative === false, 'preview not authoritative');

const forged = m.sanitizeClientStructureAnalysisClaim({
  ...native,
  authoritative: true,
});
check(forged === null, 'client cannot claim authoritative');

check(
  m.mapStructureModularityToComposition('full') === 'modular-parts',
  'map full',
);
check(m.mapStructureModularityToComposition('baked') === 'monolithic', 'map baked');

console.log('avatar-v2-structure-analyzer-check OK');

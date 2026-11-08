#!/usr/bin/env node
/**
 * avatar-v2-artifact-pipeline-check — deterministic tests for #251.
 * Location: scripts/avatar-v2-artifact-pipeline-check.mjs
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
    console.error(`avatar-v2-artifact-pipeline-check FAIL: ${msg}`);
    process.exit(1);
  }
}

const domain = read('src/domains/character/avatar/avatar-artifact-contract-v2.ts');
const index = read('src/domains/character/avatar/index.ts');
const service = read(
  'src/infrastructure/character/avatar/character-avatar-artifact-service.ts',
);
const migration = read('archive/supabase-legacy/supabase/migrations/036_character_avatar_artifacts.sql');

check(/AVATAR_ARTIFACT_CONTRACT_VERSION/.test(domain), 'contract version');
check(/materializeAvatarArtifact/.test(domain), 'materialize');
check(/createInMemoryAvatarArtifactRepository/.test(domain), 'in-memory repo');
check(/sanitizeClientAvatarArtifactMutation/.test(domain), 'client sanitize');
check(/mapImportAssetToArtifactInput/.test(domain), 'import map');
check(/mapGenerateJobToArtifactInput/.test(domain), 'generate map');
check(/mapTemplateToArtifactInput/.test(domain), 'template map');
check(!/from ['"]react['"]/.test(domain), 'no react in domain');
check(!/from ['"]@supabase/.test(domain), 'no supabase in domain');
check(/materializeAvatarArtifact/.test(index), 'barrel export');
check(/createAvatarArtifact/.test(service), 'infra create');
check(/activateAvatarArtifact/.test(service), 'infra activate');
check(/materializeArtifactFromImportAsset/.test(service), 'infra import map');
check(/materializeArtifactFromGenerateJob/.test(service), 'infra generate map');
check(/character_avatar_artifacts/.test(migration), 'migration table');
check(/idx_character_avatar_artifacts_one_active/.test(migration), 'exactly-one-active');
check(/guard_character_avatar_artifact_escalation/.test(migration), 'escalation guard');
check(/analysis_status = 'pending'/.test(migration), 'insert pending only');
check(/avatar-asset:/.test(migration), 'logical asset key constraint');
check(existsSync(join(root, 'archive/supabase-legacy/supabase/migrations/024_character_avatar_import.sql')), 'legacy import kept');
check(existsSync(join(root, 'archive/supabase-legacy/supabase/migrations/026_character_avatar_meshy_jobs.sql')), 'legacy generate kept');

const outDir = join(root, 'node_modules/.cache/avatar-v2-artifact-pipeline-check');
mkdirSync(outDir, { recursive: true });
const outfile = join(outDir, 'artifact.mjs');
await build({
  entryPoints: [join(root, 'src/domains/character/avatar/avatar-artifact-contract-v2.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  logLevel: 'silent',
});
const m = await import(outfile + `?t=${Date.now()}`);

const ownerA = '11111111-1111-1111-1111-111111111111';
const ownerB = '22222222-2222-2222-2222-222222222222';
const characterId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const now = '2026-09-19T12:00:00.000Z';

// Template / Import / Generate share same materialize contract
const template = m.materializeAvatarArtifact(
  m.mapTemplateToArtifactInput({
    artifactId: 't1',
    ownerUserId: ownerA,
    characterId,
    templateId: 'species-human-standard',
    storagePath: `${ownerA}/t1.template`,
    nowIso: now,
  }),
);
check(template.source.origin === 'sagatree', 'template origin');
check(template.analysisStatus === 'pending', 'template analysis pending');
check(template.isActive === false, 'template inactive until activate');
check(template.asset.assetKey.startsWith('avatar-asset:'), 'template asset key');

const imported = m.materializeAvatarArtifact(
  m.mapImportAssetToArtifactInput({
    importAssetId: 'i1',
    ownerUserId: ownerA,
    characterId,
    storagePath: `${ownerA}/i1.glb`,
    format: 'glb',
    nowIso: now,
  }),
);
check(imported.source.origin === 'import', 'import origin');
check(imported.source.importAssetId === 'i1', 'import ref');

const generated = m.materializeAvatarArtifact(
  m.mapGenerateJobToArtifactInput({
    generateJobId: 'g1',
    ownerUserId: ownerA,
    characterId,
    storagePath: `${ownerA}/g1.glb`,
    providerId: 'meshy',
    nowIso: now,
  }),
);
check(generated.source.origin === 'generate', 'generate origin');
check(generated.source.legacySource === 'meshy', 'legacy meshy');
check(generated.source.providerId === 'meshy', 'provider id');

// Free URL rejected
let threw = false;
try {
  m.materializeAvatarArtifact({
    artifactId: 'bad',
    ownerUserId: ownerA,
    origin: 'import',
    format: 'glb',
    storagePath: 'https://evil.example/mesh.glb',
  });
} catch {
  threw = true;
}
check(threw, 'rejects free URL storage path');

// Cross-owner + failed materialization + exactly-one-active + idempotent retry
const repo = m.createInMemoryAvatarArtifactRepository();
await repo.create(template);
await repo.create(imported);
await repo.create(generated);

const foreign = await repo.getById(ownerB, template.artifactId);
check(foreign === null, 'cross-owner get denied');

const failed = m.markAvatarArtifactMaterializationFailed(
  m.materializeAvatarArtifact(
    m.mapImportAssetToArtifactInput({
      importAssetId: 'fail1',
      ownerUserId: ownerA,
      characterId,
      storagePath: `${ownerA}/fail1.glb`,
      format: 'glb',
      nowIso: now,
    }),
  ),
  now,
);
await repo.create(failed);
const failActivate = await repo.activate(ownerA, failed.artifactId);
check(failActivate.ok === false, 'failed materialization not activated');

const act1 = await repo.activate(ownerA, imported.artifactId);
check(act1.ok === true && act1.artifact.isActive === true, 'activate import');
const act2 = await repo.activate(ownerA, generated.artifactId);
check(act2.ok === true && act2.artifact.isActive === true, 'activate generate');
const listed = await repo.listByOwner(ownerA, characterId);
const actives = listed.filter((a) => a.isActive);
check(actives.length === 1, `exactly-one-active got ${actives.length}`);
check(actives[0].artifactId === generated.artifactId, 'latest active is generate');

const first = await repo.create(generated);
const retry = await repo.create({
  ...generated,
  artifactId: 'g1-retry-different-id-should-not-matter',
});
check(retry.artifactId === first.artifactId, 'provider retry idempotent same identity');

const sanitized = m.sanitizeClientAvatarArtifactMutation(imported, {
  analysisStatus: 'ready',
  origin: 'generate',
  isActive: true,
});
check(sanitized.analysisStatus === 'pending', 'client cannot escalate analysis');
check(sanitized.source.origin === 'import', 'client cannot rewrite origin');
check(sanitized.isActive === false, 'client cannot force active via sanitize');

console.log('avatar-v2-artifact-pipeline-check OK');

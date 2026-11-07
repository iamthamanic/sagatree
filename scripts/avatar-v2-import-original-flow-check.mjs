#!/usr/bin/env node
/**
 * avatar-v2-import-original-flow-check — deterministic tests for #261.
 * Location: scripts/avatar-v2-import-original-flow-check.mjs
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
    console.error(`avatar-v2-import-original-flow-check FAIL: ${msg}`);
    process.exit(1);
  }
}

const flow = read('src/domains/character/avatar/import-original-flow-v1.ts');
const index = read('src/domains/character/avatar/index.ts');
const service = read('src/infrastructure/character/avatar/character-avatar-import-service.ts');
const panel = read('src/app/character/avatar/AvatarImportPanel.tsx');
const editor = [
  read('src/app/character/edit/CharacterEditor.tsx'),
  read('src/app/character/edit/useCharacterAvatarEditor.ts'),
].join('\n');
const source = read('src/domains/character/avatar/avatar-source.ts');
const entity = read('src/domains/character/domain/character.entity.ts');
const composition = read('src/domains/character/avatar/composition-contract-v2.ts');
const spec = read('docs/avatar-v2-modular-glb-spec.md');

check(/IMPORT_ORIGINAL_FLOW_STATUSES/.test(flow), 'flow statuses');
check(/ready-humanoid/.test(flow) && /ready-custom/.test(flow), 'ready states');
check(/Original behalten|canKeepOriginal/.test(flow), 'keep original contract');
check(/AVATAR_IMPORT_GLB_SPEC_HELP_HREF/.test(flow), 'help href constant');
check(!/from ['"]react['"]/.test(flow), 'flow domain no React');
check(/Compact passt am besten/.test(flow), 'family product copy');
check(/buildImportAnalysisSummary/.test(index), 'barrel summary');
check(/buildImportOriginalKeepSeed/.test(index), 'barrel keep seed');
check(/uploadAndAnalyzeCharacterAvatarModel/.test(service), 'upload+analyze');
check(/keepOriginalImportedAvatar/.test(service), 'keep original activate');
check(/activateAvatarArtifact/.test(service), 'draft import inactive until keep (host activate)');
check(/publishHostAvatarModel/.test(service), 'host AssetPorts upload (CUT-20)');
check(!/is_active:\s*true/.test(service), 'does not auto-activate draft on upload');
check(!/anatomy:\s*['"]humanoid['"]/.test(service), 'service does not invent anatomy');
check(/previewAnalyzeAvatarGlbBytes/.test(service), 'preview analysis');
check(/resolveFamilyCompatibilityFromAnalysis/.test(service), 'family from analysis');
check(/Original behalten/.test(panel), 'keep CTA');
check(/data-avatar-import-keep-original/.test(panel), 'keep test id');
check(/data-avatar-import-analysis-summary/.test(panel), 'summary test id');
check(/data-avatar-import-glb-help/.test(panel), 'help link');
check(/AVATAR_IMPORT_GLB_SPEC_HELP_HREF/.test(panel), 'panel uses help href');
check(/onKeepOriginal/.test(panel) && /onKeepOriginal/.test(editor), 'editor wires keep');
check(/applyImportOriginalKeep/.test(editor), 'editor keep handler');
check(/importComposition/.test(editor), 'import composition state');
check(/3D-Modell importieren/.test(source) || /3D-Modell importieren/.test(panel), 'v2 CTA copy');
check(/custom-creature/.test(entity), 'DTO anatomy custom-creature');
check(/body_compatibility\?:/.test(entity), 'DTO body_compatibility');
check(/monolithic/.test(entity), 'DTO modularity monolithic');
check(/non-humanoid/.test(composition) && /custom-creature/.test(composition), 'legacy anatomy map');
check(/none['"]\s*\?\s*['"]monolithic/.test(composition) || /modularity === 'none'/.test(composition), 'legacy modularity map');
check(/SagaTree Modular Avatar GLB v1/.test(spec), 'spec doc exists');

const outDir = join(root, 'node_modules/.cache/avatar-v2-import-original-flow-check');
mkdirSync(outDir, { recursive: true });
const outfile = join(outDir, 'flow.mjs');
await build({
  entryPoints: [join(root, 'src/domains/character/avatar/import-original-flow-v1.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  logLevel: 'silent',
});
const m = await import(outfile + `?t=${Date.now()}`);

const assert = m.assertImportOriginalFlowInvariants();
check(assert.ok, `invariants: ${assert.issues.join('; ')}`);

const humanoidReady = m.resolveImportFlowStatusFromAnalysis({
  analysis: {
    status: 'ready',
    anatomy: 'humanoid',
    modularity: 'modular-parts',
    modularityKind: 'full',
  },
  compatibility: { status: 'family-compatible', recommendedFamily: 'compact' },
});
check(humanoidReady === 'ready-humanoid', 'humanoid+family → ready-humanoid');

const customCreature = m.resolveImportFlowStatusFromAnalysis({
  analysis: {
    status: 'ready',
    anatomy: 'custom-creature',
    modularity: 'monolithic',
    modularityKind: 'baked',
  },
  compatibility: { status: 'custom', recommendedFamily: 'custom' },
});
check(customCreature === 'ready-custom', 'creature → ready-custom');

const unmatchedHumanoid = m.resolveImportFlowStatusFromAnalysis({
  analysis: {
    status: 'ready',
    anatomy: 'humanoid',
    modularity: 'limited',
    modularityKind: 'partial',
  },
  compatibility: { status: 'custom', recommendedFamily: 'custom' },
});
check(unmatchedHumanoid === 'ready-custom', 'unmatched humanoid stays custom');

const failed = m.resolveImportFlowStatusFromAnalysis({
  analysis: {
    status: 'failed',
    anatomy: 'unknown',
    modularity: 'limited',
    modularityKind: 'baked',
  },
  compatibility: { status: 'insufficient-evidence', recommendedFamily: 'custom' },
});
check(failed === 'failed', 'failed analysis');

const summary = m.buildImportAnalysisSummary({
  analysis: {
    contractVersion: 'SagaTreeAvatarStructureAnalyzerV2',
    status: 'ready',
    anatomy: 'humanoid',
    modularityKind: 'full',
    modularity: 'modular-parts',
    roles: [],
    humanoidBoneCount: 15,
    missingHumanoidBones: [],
    limitations: [],
    warnings: [],
    evidence: {
      nodeCount: 10,
      meshCount: 2,
      skinnedMeshCount: 1,
      skeletonCount: 1,
      boneCount: 20,
      morphTargetCount: 0,
      truncated: false,
      metadataValidated: false,
      metadataContradictedGeometry: false,
    },
    authoritative: false,
  },
  compatibility: {
    contractVersion: 'SagaTreeBodyProfileV1',
    status: 'family-compatible',
    recommendedFamily: 'compact',
    scores: [{ familyId: 'compact', score: 0.9 }],
    threshold: 0.82,
    confidence: 0.9,
    validationStatus: 'valid',
    limitations: [],
  },
});
check(summary.flowStatus === 'ready-humanoid', 'summary humanoid');
check(summary.canKeepOriginal === true, 'can keep');
check(/Compact passt am besten/.test(summary.familyLabelDe), 'family copy DE');
check(!/#\d+/.test(summary.headlineDe + summary.detailDe), 'no ticket numbers in copy');
check(!/Meshy|Tripo|provider/i.test(summary.headlineDe + summary.detailDe), 'no provider in copy');

const keep = m.buildImportOriginalKeepSeed({
  modelUrl: 'https://example.invalid/signed',
  artifactId: 'art-1',
  importAssetId: 'imp-1',
  analysis: { anatomy: 'custom-creature', modularity: 'monolithic' },
  compatibility: { recommendedFamily: 'standard', status: 'family-compatible' },
});
check(keep.bodyFamily === 'custom', 'creature keep forces custom family');
check(keep.capabilities.length === 0, 'capabilities empty until rig analysis');

check(existsSync(join(root, '.qa/acceptance/avatar-v2-import-original-flow.md')), 'acceptance exists');
check(
  m.AVATAR_IMPORT_GLB_SPEC_HELP_HREF.includes('avatar-v2-modular-glb-spec.md'),
  'help points at GLB spec',
);

console.log('avatar-v2-import-original-flow-check PASS');

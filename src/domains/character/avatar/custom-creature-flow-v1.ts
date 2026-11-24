/**
 * Avatar V2 Custom Creature Original Flow — pure domain (#266 / Epic #248).
 * Location: src/domains/character/avatar/custom-creature-flow-v1.ts
 *
 * Product path for Faruk-like / free-form bodies: keep original geometry,
 * activate only evidence-backed capabilities, optional humanoid conversion.
 * No React / Three / backend clients.
 */

import {
  buildImportAnalysisSummary,
  buildImportOriginalKeepSeed,
  morphEvidenceFromImportAnalysis,
  type ImportAnalysisSummaryV1,
  type ImportOriginalKeepSeedV1,
} from './import-original-flow-v1';
import {
  selectRigPathForFixture,
  type CustomRigBenchmarkFixtureId,
} from './custom-rig-decision-v1';
import type { AvatarRigCapabilityFlagV2 } from './rig-capability-contract-v2';
import { resolveMorphEvidenceForComposition } from './editor-surface-resolver-v1';

export const CUSTOM_CREATURE_FLOW_CONTRACT_VERSION =
  'SagaTreeCustomCreatureFlowV1' as const;

export interface CustomCreatureFlowGuidanceV1 {
  contractVersion: typeof CUSTOM_CREATURE_FLOW_CONTRACT_VERSION;
  recommendOriginal: true;
  headlineDe: string;
  detailDe: string;
  wardrobeLimitationDe: string;
  autoRigOptionalDe: string;
  conversionInterpretationDe: string;
  /** Never force SagaTree morph edit-norm on custom mesh. */
  allowHumanoidMorph: false;
  /** Prefer import-existing per #265 benchmark. */
  preferredRigPath: 'import-existing-rig';
  autoRigOptional: true;
}

export interface CustomCreatureEditorSeedV1 {
  contractVersion: typeof CUSTOM_CREATURE_FLOW_CONTRACT_VERSION;
  modelUrl: string;
  artifactId: string;
  importAssetId: string;
  anatomy: 'custom-creature';
  bodyFamily: 'custom';
  bodyCompatibility: 'custom';
  modularity: ImportOriginalKeepSeedV1['modularity'];
  /** Empty until Analyzer V2 — never invent. */
  capabilities: readonly AvatarRigCapabilityFlagV2[];
  allowHumanoidMorph: false;
  guidance: CustomCreatureFlowGuidanceV1;
}

export function isCustomCreatureImportSummary(
  summary: Pick<ImportAnalysisSummaryV1, 'anatomy' | 'flowStatus'>,
): boolean {
  return (
    summary.anatomy === 'custom-creature' ||
    summary.flowStatus === 'ready-custom'
  );
}

export function buildCustomCreatureFlowGuidance(): CustomCreatureFlowGuidanceV1 {
  const path = selectRigPathForFixture({
    fixtureId: 'faruk-like' satisfies CustomRigBenchmarkFixtureId,
    hasImportedRig: true,
  });
  return {
    contractVersion: CUSTOM_CREATURE_FLOW_CONTRACT_VERSION,
    recommendOriginal: true,
    headlineDe: 'Eigener Körper — Original behalten empfohlen',
    detailDe:
      'Dieser Körper ist kein Standard/Compact/Heavy. Du kannst ihn als Original nutzen; ' +
      'SagaTree aktiviert nur tatsächlich erkannte Fähigkeiten.',
    wardrobeLimitationDe:
      'Standard-SagaTree-Kleidung (Family-Wearables) passt nicht automatisch auf diesen Körper.',
    autoRigOptionalDe:
      path.autoRigOptional
        ? 'Auto-Rig ist optional. Fehlt ein brauchbares Rig, bleibt der Avatar eingeschränkt nutzbar — kein Abbruch.'
        : 'Auto-Rig folgt der Benchmark-Entscheidung.',
    conversionInterpretationDe:
      '„Auf SagaTree-Körper übertragen“ ist eine humanoide Interpretation — die Silhouette ändert sich deutlich.',
    allowHumanoidMorph: false,
    preferredRigPath: 'import-existing-rig',
    autoRigOptional: true,
  };
}

/**
 * Editor seed from Import Keep when anatomy is custom-creature.
 * Capabilities stay empty (Analyzer owns them).
 */
export function buildCustomCreatureEditorSeed(
  keepSeed: ImportOriginalKeepSeedV1,
): CustomCreatureEditorSeedV1 {
  return {
    contractVersion: CUSTOM_CREATURE_FLOW_CONTRACT_VERSION,
    modelUrl: keepSeed.modelUrl,
    artifactId: keepSeed.artifactId,
    importAssetId: keepSeed.importAssetId,
    anatomy: 'custom-creature',
    bodyFamily: 'custom',
    bodyCompatibility: 'custom',
    modularity: keepSeed.modularity,
    capabilities: [],
    allowHumanoidMorph: false,
    guidance: buildCustomCreatureFlowGuidance(),
  };
}

/**
 * Deterministic Faruk-like vertical slice: analyze → keep original → editor seed.
 * No humanoid morph force; capabilities stay empty until Analyzer.
 */
export function runFarukLikeOriginalKeepSlice(): {
  summary: ImportAnalysisSummaryV1;
  keepSeed: ImportOriginalKeepSeedV1;
  editorSeed: CustomCreatureEditorSeedV1;
  morphForced: false;
  morphEvidenceEmpty: boolean;
  clothingSurfaceOff: boolean;
} {
  const summary = buildImportAnalysisSummary({
    analysis: {
      contractVersion: 'SagaTreeAvatarStructureAnalyzerV2',
      status: 'ready',
      anatomy: 'custom-creature',
      modularityKind: 'baked',
      modularity: 'monolithic',
      roles: [],
      humanoidBoneCount: 0,
      missingHumanoidBones: [],
      limitations: [],
      warnings: [],
      evidence: {
        nodeCount: 12,
        meshCount: 3,
        skinnedMeshCount: 1,
        skeletonCount: 1,
        boneCount: 8,
        morphTargetCount: 0,
        truncated: false,
        metadataValidated: false,
        metadataContradictedGeometry: false,
      },
      authoritative: false,
    },
    compatibility: {
      contractVersion: 'SagaTreeBodyProfileV1',
      status: 'custom',
      recommendedFamily: 'custom',
      scores: [],
      threshold: 0.82,
      confidence: 0.2,
      validationStatus: 'skipped-non-humanoid',
      limitations: [],
    },
  });
  const keepSeed = buildImportOriginalKeepSeed({
    modelUrl: 'https://example.invalid/faruk-like.glb',
    artifactId: 'artifact-faruk-like',
    importAssetId: 'import-faruk-like',
    analysis: {
      anatomy: 'custom-creature',
      modularity: 'monolithic',
    },
    compatibility: {
      recommendedFamily: 'custom',
      status: 'custom',
    },
  });
  const editorSeed = buildCustomCreatureEditorSeed(keepSeed);
  const morph = morphEvidenceFromImportAnalysis({
    anatomy: 'custom-creature',
    modularity: 'monolithic',
  });
  const morphEvidence = resolveMorphEvidenceForComposition({
    composition: { anatomy: 'custom-creature', modularity: 'monolithic' },
    hasExternalModel: true,
    inspected: {
      hasBodyMorphTargets: morph.hasBodyMorphTargets,
      hasFaceMorphTargets: morph.hasFaceMorphTargets,
    },
  });
  return {
    summary,
    keepSeed,
    editorSeed,
    morphForced: false,
    morphEvidenceEmpty: morphEvidence.morphFlags.length === 0,
    clothingSurfaceOff: true,
  };
}

export function assertCustomCreatureFlowInvariants(): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const g = buildCustomCreatureFlowGuidance();
  if (!g.recommendOriginal) issues.push('must recommend original');
  if (g.allowHumanoidMorph !== false) issues.push('no humanoid morph');
  if (g.preferredRigPath !== 'import-existing-rig') {
    issues.push('prefer import-existing-rig');
  }
  if (!g.autoRigOptional) issues.push('auto-rig optional');
  if (!/humanoide Interpretation/.test(g.conversionInterpretationDe)) {
    issues.push('conversion interpretation copy');
  }
  if (!/Kleidung/.test(g.wardrobeLimitationDe)) {
    issues.push('wardrobe limitation copy');
  }
  const seed = buildCustomCreatureEditorSeed({
    contractVersion: 'SagaTreeImportOriginalFlowV1',
    modelUrl: 'https://example.invalid/m',
    artifactId: 'a',
    importAssetId: 'i',
    anatomy: 'custom-creature',
    bodyFamily: 'custom',
    bodyCompatibility: 'custom',
    modularity: 'monolithic',
    capabilities: [],
  });
  if (seed.capabilities.length !== 0) issues.push('capabilities empty');
  if (seed.anatomy !== 'custom-creature' || seed.bodyFamily !== 'custom') {
    issues.push('custom axes');
  }
  if (
    !isCustomCreatureImportSummary({
      anatomy: 'custom-creature',
      flowStatus: 'ready-custom',
    })
  ) {
    issues.push('summary detector');
  }
  const slice = runFarukLikeOriginalKeepSlice();
  if (slice.summary.flowStatus !== 'ready-custom') {
    issues.push('faruk flowStatus ready-custom');
  }
  if (!slice.summary.canKeepOriginal) issues.push('faruk can keep');
  if (slice.keepSeed.bodyFamily !== 'custom') issues.push('faruk keep custom');
  if (slice.editorSeed.allowHumanoidMorph !== false) {
    issues.push('faruk no morph force');
  }
  if (!slice.morphEvidenceEmpty) issues.push('faruk morph empty');
  if (!slice.clothingSurfaceOff) issues.push('faruk clothing off');
  return { ok: issues.length === 0, issues };
}

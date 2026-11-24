/**
 * Avatar V2 Import Original Flow — pure domain (#261 / Epic #248).
 * Location: src/domains/character/avatar/import-original-flow-v1.ts
 *
 * Orchestrates Upload→Analyze→Original-behalten states and product copy.
 * Never invents anatomy/family/capabilities — only maps validated analysis.
 * No React / backend clients / Three / glTF IO.
 */

import type { PerformanceFaceValidationReportV1 } from '../liveact/liveact-performance-face-contract';
import {
  evaluatePerformanceFaceForImport,
  type PerformanceFaceInventoryV1,
} from '../liveact/liveact-performance-face-validate';
import type { AvatarStructureAnalysisResultV2 } from './avatar-structure-analyzer-v2';
import type { FamilyCompatibilityResultV1 } from './body-profile-contract-v1';
import type {
  AvatarV2Anatomy,
  AvatarV2BodyFamily,
  AvatarV2Modularity,
} from './composition-contract-v2';
import type { AvatarRigCapabilityFlag } from './rig-contract';

export const IMPORT_ORIGINAL_FLOW_CONTRACT_VERSION =
  'SagaTreeImportOriginalFlowV1' as const;

/** Provider-neutral GLB structure help (repo doc; linked from Import UI). */
export const AVATAR_IMPORT_GLB_SPEC_HELP_HREF =
  'https://github.com/iamthamanic/sagatree/blob/main/docs/avatar-v2-modular-glb-spec.md';

export const AVATAR_IMPORT_GLB_SPEC_HELP_LABEL_DE =
  'Hilfe: SagaTree Modular Avatar GLB v1';

/**
 * Wizard states for Import Flow v2.
 * Success is split into ready-humanoid / ready-custom / limited (not a single success).
 */
export const IMPORT_ORIGINAL_FLOW_STATUSES = [
  'idle',
  'validating',
  'uploading',
  'analyzing',
  'ready-humanoid',
  'ready-custom',
  'limited',
  'failed',
] as const;

export type ImportOriginalFlowStatus =
  (typeof IMPORT_ORIGINAL_FLOW_STATUSES)[number];

export interface ImportAnalysisSummaryV1 {
  contractVersion: typeof IMPORT_ORIGINAL_FLOW_CONTRACT_VERSION;
  flowStatus: ImportOriginalFlowStatus;
  anatomy: AvatarV2Anatomy;
  modularity: AvatarV2Modularity;
  modularityKindLabelDe: string;
  recommendedFamily: AvatarV2BodyFamily;
  familyLabelDe: string;
  anatomyLabelDe: string;
  modularityLabelDe: string;
  capabilitiesLabelDe: string;
  headlineDe: string;
  detailDe: string;
  limitationsDe: readonly string[];
  /** True when Keep Original is allowed (not failed / not mid-flight). */
  canKeepOriginal: boolean;
}

export interface ImportOriginalKeepSeedV1 {
  contractVersion: typeof IMPORT_ORIGINAL_FLOW_CONTRACT_VERSION;
  modelUrl: string;
  artifactId: string;
  importAssetId: string;
  anatomy: AvatarV2Anatomy;
  bodyFamily: AvatarV2BodyFamily;
  bodyCompatibility: AvatarV2BodyFamily | 'unknown';
  modularity: AvatarV2Modularity;
  /** Empty until authoritative rig analysis (#6) — never invented here. */
  capabilities: readonly AvatarRigCapabilityFlag[];
}

const FAMILY_LABEL_DE: Record<AvatarV2BodyFamily, string> = {
  standard: 'Standard passt am besten',
  compact: 'Compact passt am besten',
  heavy: 'Heavy passt am besten',
  custom: 'Eigener Körper',
};

const ANATOMY_LABEL_DE: Record<AvatarV2Anatomy, string> = {
  humanoid: 'Humanoid',
  'custom-creature': 'Eigener Körper (Kreatur)',
  unknown: 'Anatomie unklar',
};

const MODULARITY_LABEL_DE: Record<AvatarV2Modularity, string> = {
  'modular-parts': 'Modular (Teile austauschbar)',
  limited: 'Eingeschränkt modular',
  monolithic: 'Einteilig (gebacken)',
};

const MODULARITY_KIND_LABEL_DE: Record<string, string> = {
  full: 'Voll modular',
  partial: 'Teilweise modular',
  baked: 'Einteilig / gebacken',
};

export function isImportOriginalFlowStatus(
  value: unknown,
): value is ImportOriginalFlowStatus {
  return (
    typeof value === 'string' &&
    (IMPORT_ORIGINAL_FLOW_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Map structure analysis + family compatibility → wizard ready state.
 * Custom creatures and unmatched humanoids never force Standard/Compact/Heavy.
 */
export function resolveImportFlowStatusFromAnalysis(input: {
  analysis: Pick<
    AvatarStructureAnalysisResultV2,
    'status' | 'anatomy' | 'modularity' | 'modularityKind'
  >;
  compatibility: Pick<FamilyCompatibilityResultV1, 'status' | 'recommendedFamily'>;
}): ImportOriginalFlowStatus {
  if (
    input.analysis.status === 'failed' ||
    input.analysis.status === 'unsupported'
  ) {
    return 'failed';
  }
  if (input.analysis.status === 'limited') {
    return 'limited';
  }
  if (input.analysis.anatomy === 'custom-creature') {
    return 'ready-custom';
  }
  if (input.analysis.anatomy === 'humanoid') {
    if (
      input.compatibility.status === 'family-compatible' &&
      input.compatibility.recommendedFamily !== 'custom'
    ) {
      return 'ready-humanoid';
    }
    // Humanoid without clean family match → custom path, not forced conversion.
    return 'ready-custom';
  }
  return 'limited';
}

function capabilityHintsFromAnalysis(
  analysis: AvatarStructureAnalysisResultV2,
): string {
  const hints: string[] = [];
  if (analysis.humanoidBoneCount >= 8) {
    hints.push('Humanoid-Skelett erkannt');
  } else if (analysis.evidence.boneCount > 0) {
    hints.push('Eigenes Rig erkannt');
  } else {
    hints.push('Kein Spiel-Rig erkannt');
  }
  if (analysis.modularityKind === 'baked' || analysis.modularity === 'monolithic') {
    hints.push('Kleidung/Teile eingeschränkt');
  } else if (analysis.modularity === 'modular-parts') {
    hints.push('Modulare Teile möglich');
  } else {
    hints.push('Teile teilweise nutzbar');
  }
  // Capabilities stay pending until authoritative rig analysis — never invent flags.
  hints.push('Fähigkeiten folgen der Rig-Analyse');
  return hints.join(' · ');
}

/**
 * Build end-user DE summary. Never surfaces ticket numbers, provider ids, or contract codes.
 */
export function buildImportAnalysisSummary(input: {
  analysis: AvatarStructureAnalysisResultV2;
  compatibility: FamilyCompatibilityResultV1;
}): ImportAnalysisSummaryV1 {
  const flowStatus = resolveImportFlowStatusFromAnalysis({
    analysis: input.analysis,
    compatibility: input.compatibility,
  });
  const recommendedFamily = input.compatibility.recommendedFamily;
  const familyLabelDe =
    flowStatus === 'ready-custom' || recommendedFamily === 'custom'
      ? FAMILY_LABEL_DE.custom
      : FAMILY_LABEL_DE[recommendedFamily];

  let headlineDe = 'Analyse abgeschlossen';
  let detailDe = 'Du kannst den Originalkörper behalten und im gemeinsamen Editor weiterarbeiten.';

  if (flowStatus === 'failed') {
    headlineDe = 'Analyse fehlgeschlagen';
    detailDe =
      'Dein bisheriger Avatar bleibt unverändert. Bitte eine andere Datei wählen oder erneut versuchen.';
  } else if (flowStatus === 'limited') {
    headlineDe = 'Eingeschränkt nutzbar';
    detailDe =
      'Das Modell kann behalten werden, aber einige Funktionen sind begrenzt (z. B. Kleidung oder Modularität).';
  } else if (flowStatus === 'ready-custom') {
    headlineDe = 'Eigener Körper erkannt';
    detailDe =
      'Kein Zwang zu Standard/Compact/Heavy. Mit „Original behalten“ bleibst du beim importierten Körper.';
  } else if (flowStatus === 'ready-humanoid') {
    headlineDe = familyLabelDe;
    detailDe =
      'Humanoides Modell erkannt. Mit „Original behalten“ öffnest du den gemeinsamen Editor mit den verfügbaren Funktionen.';
  }

  const limitationsDe = [
    ...input.analysis.limitations,
    ...input.compatibility.limitations,
  ].filter((line) => line.trim().length > 0);

  return {
    contractVersion: IMPORT_ORIGINAL_FLOW_CONTRACT_VERSION,
    flowStatus,
    anatomy: input.analysis.anatomy,
    modularity: input.analysis.modularity,
    modularityKindLabelDe:
      MODULARITY_KIND_LABEL_DE[input.analysis.modularityKind] ??
      MODULARITY_LABEL_DE[input.analysis.modularity],
    recommendedFamily,
    familyLabelDe,
    anatomyLabelDe: ANATOMY_LABEL_DE[input.analysis.anatomy],
    modularityLabelDe: MODULARITY_LABEL_DE[input.analysis.modularity],
    capabilitiesLabelDe: capabilityHintsFromAnalysis(input.analysis),
    headlineDe,
    detailDe,
    limitationsDe,
    canKeepOriginal:
      flowStatus === 'ready-humanoid' ||
      flowStatus === 'ready-custom' ||
      flowStatus === 'limited',
  };
}

/**
 * Morph evidence for the shared editor after Keep Original.
 * Without named target inspection, fail-closed (no invented body/face morph unlock).
 */
export function morphEvidenceFromImportAnalysis(
  _analysis: Pick<AvatarStructureAnalysisResultV2, 'anatomy' | 'modularity'>,
): { hasBodyMorphTargets: boolean; hasFaceMorphTargets: boolean } {
  // Anatomy/modularity alone does not prove SagaTree morph targets.
  void _analysis;
  return { hasBodyMorphTargets: false, hasFaceMorphTargets: false };
}

/**
 * Performance Face V2 on Import Original (#450).
 * Always allows import; Premium gaps only downgrade eligibility in the report.
 * Call when morph/expression names are available (structure morph count alone is not enough).
 */
export function evaluateImportOriginalPerformanceFace(input: {
  inventory: PerformanceFaceInventoryV1;
}): {
  importAllowed: true;
  blocksImport: false;
  report: PerformanceFaceValidationReportV1;
} {
  return evaluatePerformanceFaceForImport(input.inventory);
}

/**
 * Materialize editor seed from analysis. Capabilities stay empty (rig #6 owns them).
 */
export function buildImportOriginalKeepSeed(input: {
  modelUrl: string;
  artifactId: string;
  importAssetId: string;
  analysis: Pick<AvatarStructureAnalysisResultV2, 'anatomy' | 'modularity'>;
  compatibility: Pick<FamilyCompatibilityResultV1, 'recommendedFamily' | 'status'>;
}): ImportOriginalKeepSeedV1 {
  const bodyFamily =
    input.analysis.anatomy === 'custom-creature'
      ? 'custom'
      : input.compatibility.recommendedFamily;
  const bodyCompatibility =
    bodyFamily === 'standard' || bodyFamily === 'compact' || bodyFamily === 'heavy'
      ? bodyFamily
      : bodyFamily === 'custom'
        ? 'custom'
        : 'unknown';

  return {
    contractVersion: IMPORT_ORIGINAL_FLOW_CONTRACT_VERSION,
    modelUrl: input.modelUrl,
    artifactId: input.artifactId,
    importAssetId: input.importAssetId,
    anatomy: input.analysis.anatomy,
    bodyFamily,
    bodyCompatibility,
    modularity: input.analysis.modularity,
    capabilities: [],
  };
}

export function assertImportOriginalFlowInvariants(): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (IMPORT_ORIGINAL_FLOW_STATUSES.length !== 8) {
    issues.push('expected 8 flow statuses');
  }
  if (!AVATAR_IMPORT_GLB_SPEC_HELP_HREF.includes('avatar-v2-modular-glb-spec.md')) {
    issues.push('help href must point at GLB v1 spec');
  }
  for (const status of [
    'ready-humanoid',
    'ready-custom',
    'limited',
    'failed',
  ] as const) {
    if (!isImportOriginalFlowStatus(status)) {
      issues.push(`missing status ${status}`);
    }
  }
  return { ok: issues.length === 0, issues };
}

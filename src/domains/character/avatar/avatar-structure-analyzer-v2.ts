/**
 * Avatar V2 Structure Analyzer contracts — pure domain (#252 / Epic #248).
 * Location: src/domains/character/avatar/avatar-structure-analyzer-v2.ts
 *
 * Derives Anatomy + Modularity from structural evidence only.
 * Metadata hints are validated, never blindly trusted when geometry disagrees.
 * No React / Three / backend clients / glTF IO here.
 */

import {
  AVATAR_V2_ANATOMIES,
  AVATAR_V2_MODULARITIES,
  type AvatarV2Anatomy,
  type AvatarV2Modularity,
  isAvatarV2Anatomy,
} from './composition-contract-v2';
import {
  MODULAR_AVATAR_GLB_CONTRACT_VERSION,
  parseModularAvatarGlbExtras,
  validateModularAvatarGlbNodes,
  type ModularAvatarGlbNodeDescriptor,
  type ModularAvatarGlbNodeRole,
} from './modular-glb-contract-v1';
import {
  listMissingHumanoidBones,
  type SagaTreeHumanoidBoneId,
} from './rig-contract';

export const AVATAR_STRUCTURE_ANALYZER_CONTRACT_VERSION =
  'SagaTreeAvatarStructureAnalyzerV2' as const;

/** Analyzer-specific modularity before mapping onto composition modularity. */
export const AVATAR_STRUCTURE_MODULARITY_KINDS = ['full', 'partial', 'baked'] as const;
export type AvatarStructureModularityKind =
  (typeof AVATAR_STRUCTURE_MODULARITY_KINDS)[number];

export const AVATAR_STRUCTURE_ANALYSIS_STATUSES = [
  'ready',
  'limited',
  'failed',
  'unsupported',
] as const;
export type AvatarStructureAnalysisStatus =
  (typeof AVATAR_STRUCTURE_ANALYSIS_STATUSES)[number];

/** Bounds for scanners — Infrastructure must enforce the same numbers. */
export const AVATAR_STRUCTURE_ANALYSIS_BOUNDS = {
  maxBytes: 150 * 1024 * 1024,
  maxNodes: 8_000,
  maxMeshes: 2_000,
  maxBones: 1_024,
  maxMorphTargets: 512,
  maxSkinnedMeshes: 256,
  maxSkeletons: 16,
} as const;

export interface AvatarStructureNodeEvidence {
  name?: string;
  extras?: unknown;
  meshIndex?: number;
  skinIndex?: number;
}

export interface AvatarStructureMeshEvidence {
  name?: string;
  primitiveCount: number;
  morphTargetCount: number;
  isSkinned: boolean;
}

export interface AvatarStructureEvidence {
  /** Byte size of the scanned asset (0 when fixture-only). */
  byteSize: number;
  nodeCount: number;
  meshCount: number;
  skinnedMeshCount: number;
  skeletonCount: number;
  boneCount: number;
  morphTargetCount: number;
  /** Canonical humanoid bones detected (source names optional). */
  humanoidBones: Readonly<Partial<Record<SagaTreeHumanoidBoneId, string>>>;
  nodes: readonly AvatarStructureNodeEvidence[];
  meshes: readonly AvatarStructureMeshEvidence[];
  /** True when scanner hit a bound and stopped early. */
  truncated: boolean;
  /** Scanner rejected remote URI / bufferView URI resolution. */
  rejectedRemoteUri: boolean;
  /** Parse/IO failure. */
  parseError?: string;
}

export interface AvatarStructureRoleHit {
  role: ModularAvatarGlbNodeRole;
  nodeName?: string;
  fromMetadata: boolean;
}

export interface AvatarStructureAnalysisResultV2 {
  contractVersion: typeof AVATAR_STRUCTURE_ANALYZER_CONTRACT_VERSION;
  status: AvatarStructureAnalysisStatus;
  anatomy: AvatarV2Anatomy;
  /** Analyzer kind: full | partial | baked */
  modularityKind: AvatarStructureModularityKind;
  /** Mapped onto Avatar V2 composition modularity axis. */
  modularity: AvatarV2Modularity;
  roles: readonly AvatarStructureRoleHit[];
  humanoidBoneCount: number;
  missingHumanoidBones: readonly SagaTreeHumanoidBoneId[];
  limitations: readonly string[];
  warnings: readonly string[];
  evidence: {
    nodeCount: number;
    meshCount: number;
    skinnedMeshCount: number;
    skeletonCount: number;
    boneCount: number;
    morphTargetCount: number;
    truncated: boolean;
    metadataValidated: boolean;
    metadataContradictedGeometry: boolean;
  };
  /** Client preview must set false; server persist sets true. */
  authoritative: boolean;
}

export function isAvatarStructureModularityKind(
  value: unknown,
): value is AvatarStructureModularityKind {
  return (
    typeof value === 'string' &&
    (AVATAR_STRUCTURE_MODULARITY_KINDS as readonly string[]).includes(value)
  );
}

export function mapStructureModularityToComposition(
  kind: AvatarStructureModularityKind,
): AvatarV2Modularity {
  if (kind === 'full') return 'modular-parts';
  if (kind === 'partial') return 'limited';
  return 'monolithic';
}

function countHumanoidBones(
  bones: Readonly<Partial<Record<SagaTreeHumanoidBoneId, string>>>,
): number {
  return Object.keys(bones).length;
}

function hasCoreHumanoidChain(
  bones: Readonly<Partial<Record<SagaTreeHumanoidBoneId, string>>>,
): boolean {
  return Boolean(bones.hips && bones.spine && bones.head);
}

/**
 * Pure derivation: structural evidence → AnalysisResult.
 * Metadata roles are preferred when structurally validated; geometry wins on conflict.
 */
export function analyzeAvatarStructureFromEvidence(
  evidence: AvatarStructureEvidence,
  options: { authoritative?: boolean } = {},
): AvatarStructureAnalysisResultV2 {
  const authoritative = options.authoritative === true;
  const limitations: string[] = [];
  const warnings: string[] = [];

  if (evidence.parseError) {
    return {
      contractVersion: AVATAR_STRUCTURE_ANALYZER_CONTRACT_VERSION,
      status: 'failed',
      anatomy: 'unknown',
      modularityKind: 'baked',
      modularity: 'monolithic',
      roles: [],
      humanoidBoneCount: 0,
      missingHumanoidBones: listMissingHumanoidBones({}),
      limitations: [`Parse fehlgeschlagen: ${evidence.parseError}`],
      warnings: [],
      evidence: {
        nodeCount: evidence.nodeCount,
        meshCount: evidence.meshCount,
        skinnedMeshCount: evidence.skinnedMeshCount,
        skeletonCount: evidence.skeletonCount,
        boneCount: evidence.boneCount,
        morphTargetCount: evidence.morphTargetCount,
        truncated: evidence.truncated,
        metadataValidated: false,
        metadataContradictedGeometry: false,
      },
      authoritative,
    };
  }

  if (evidence.rejectedRemoteUri) {
    limitations.push('Remote-URIs in glTF wurden abgelehnt (keine Netzwerk-Auflösung).');
  }
  if (evidence.truncated) {
    limitations.push('Analyse an Bounds abgebrochen — Ergebnis ggf. unvollständig.');
  }
  if (evidence.byteSize > AVATAR_STRUCTURE_ANALYSIS_BOUNDS.maxBytes) {
    return failUnsupported(evidence, authoritative, [
      ...limitations,
      'Asset überschreitet die erlaubte Maximalgröße.',
    ]);
  }

  const descriptors: ModularAvatarGlbNodeDescriptor[] = evidence.nodes.map((node) => ({
    name: node.name,
    extras: node.extras,
  }));
  const metaValidation = validateModularAvatarGlbNodes(descriptors);
  const metadataValidated =
    metaValidation.status === 'valid' || metaValidation.status === 'needs-review';

  const roles: AvatarStructureRoleHit[] = [];
  for (const node of evidence.nodes) {
    const parsed = parseModularAvatarGlbExtras(node.extras);
    if (parsed.extras) {
      roles.push({
        role: parsed.extras.role,
        nodeName: node.name,
        fromMetadata: true,
      });
    }
  }

  if (metaValidation.status === 'invalid') {
    warnings.push('SagaTree-Metadaten ungültig — strukturelle Evidence hat Vorrang.');
  } else if (metaValidation.status === 'needs-review') {
    warnings.push('SagaTree-Metadaten benötigen Review (Version/Felder).');
  }

  const humanoidBoneCount = countHumanoidBones(evidence.humanoidBones);
  const missingHumanoidBones = listMissingHumanoidBones(evidence.humanoidBones);
  const coreHumanoid = hasCoreHumanoidChain(evidence.humanoidBones);

  let anatomy: AvatarV2Anatomy = 'unknown';
  if (coreHumanoid && evidence.skinnedMeshCount >= 1) {
    anatomy = 'humanoid';
  } else if (
    evidence.skinnedMeshCount >= 1 ||
    evidence.boneCount >= 3 ||
    evidence.meshCount >= 1
  ) {
    // Non-humanoid but present creature/mesh structure.
    anatomy = humanoidBoneCount > 0 && humanoidBoneCount < 6 ? 'custom-creature' : 'custom-creature';
    if (!coreHumanoid && evidence.boneCount > 0) {
      anatomy = 'custom-creature';
    }
    if (evidence.meshCount >= 1 && evidence.boneCount === 0 && evidence.skinnedMeshCount === 0) {
      // Static mesh only — still a valid artifact; anatomy unknown unless metadata claims creature.
      anatomy = 'unknown';
    }
  }

  // Metadata claiming body role does not force humanoid without bone evidence.
  let metadataContradictedGeometry = false;
  const metaClaimsBody = roles.some((r) => r.role === 'body');
  if (metaClaimsBody && anatomy === 'unknown' && evidence.skinnedMeshCount === 0) {
    metadataContradictedGeometry = true;
    warnings.push(
      'Metadaten melden body-Rolle, Geometrie zeigt kein SkinnedMesh/Skelett — Geometrie gewinnt.',
    );
  }

  let modularityKind: AvatarStructureModularityKind = 'baked';
  const distinctMetaRoles = new Set(roles.map((r) => r.role));
  if (
    distinctMetaRoles.has('body') &&
    (distinctMetaRoles.has('wearable') || distinctMetaRoles.has('trait')) &&
    evidence.meshCount >= 2
  ) {
    modularityKind = 'full';
  } else if (
    evidence.meshCount >= 2 &&
    (evidence.skinnedMeshCount >= 1 || distinctMetaRoles.size >= 2)
  ) {
    modularityKind = 'partial';
  } else if (evidence.meshCount <= 1 && evidence.skinnedMeshCount <= 1) {
    modularityKind = 'baked';
  } else if (evidence.meshCount >= 2) {
    modularityKind = 'partial';
  }

  if (evidence.skeletonCount > 1) {
    limitations.push('Mehrere Skeletons erkannt — begrenzte Wearable-/Rig-Annahmen.');
    if (anatomy === 'humanoid') {
      // Still humanoid if core chain present, but limited.
    } else {
      anatomy = 'custom-creature';
    }
  }

  if (!isAvatarV2Anatomy(anatomy)) {
    anatomy = 'unknown';
  }

  const modularity = mapStructureModularityToComposition(modularityKind);

  let status: AvatarStructureAnalysisStatus = 'ready';
  if (limitations.length > 0 || modularityKind !== 'full' || anatomy === 'unknown') {
    status = 'limited';
  }
  if (evidence.meshCount === 0 && evidence.nodeCount === 0) {
    status = 'failed';
    limitations.push('Keine Mesh-/Node-Struktur gefunden.');
  }
  if (evidence.rejectedRemoteUri && evidence.meshCount === 0) {
    status = 'unsupported';
  }

  return {
    contractVersion: AVATAR_STRUCTURE_ANALYZER_CONTRACT_VERSION,
    status,
    anatomy,
    modularityKind,
    modularity,
    roles,
    humanoidBoneCount,
    missingHumanoidBones,
    limitations,
    warnings,
    evidence: {
      nodeCount: evidence.nodeCount,
      meshCount: evidence.meshCount,
      skinnedMeshCount: evidence.skinnedMeshCount,
      skeletonCount: evidence.skeletonCount,
      boneCount: evidence.boneCount,
      morphTargetCount: evidence.morphTargetCount,
      truncated: evidence.truncated,
      metadataValidated,
      metadataContradictedGeometry,
    },
    authoritative,
  };
}

function failUnsupported(
  evidence: AvatarStructureEvidence,
  authoritative: boolean,
  limitations: string[],
): AvatarStructureAnalysisResultV2 {
  return {
    contractVersion: AVATAR_STRUCTURE_ANALYZER_CONTRACT_VERSION,
    status: 'unsupported',
    anatomy: 'unknown',
    modularityKind: 'baked',
    modularity: 'monolithic',
    roles: [],
    humanoidBoneCount: 0,
    missingHumanoidBones: listMissingHumanoidBones({}),
    limitations,
    warnings: [],
    evidence: {
      nodeCount: evidence.nodeCount,
      meshCount: evidence.meshCount,
      skinnedMeshCount: evidence.skinnedMeshCount,
      skeletonCount: evidence.skeletonCount,
      boneCount: evidence.boneCount,
      morphTargetCount: evidence.morphTargetCount,
      truncated: evidence.truncated,
      metadataValidated: false,
      metadataContradictedGeometry: false,
    },
    authoritative,
  };
}

/** Client UX helper — never marks authoritative. */
export function previewAnalyzeAvatarStructure(
  evidence: AvatarStructureEvidence,
): AvatarStructureAnalysisResultV2 {
  return analyzeAvatarStructureFromEvidence(evidence, { authoritative: false });
}

/** Server path — authoritative result for persistence. */
export function authoritativeAnalyzeAvatarStructure(
  evidence: AvatarStructureEvidence,
): AvatarStructureAnalysisResultV2 {
  return analyzeAvatarStructureFromEvidence(evidence, { authoritative: true });
}

/**
 * Strip client-supplied analysis payloads — only pending/failed local markers survive;
 * full AnalysisResult must come from authoritativeAnalyzeAvatarStructure.
 */
export function sanitizeClientStructureAnalysisClaim(
  payload: unknown,
): AvatarStructureAnalysisResultV2 | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const record = payload as Record<string, unknown>;
  if (record.authoritative === true) {
    // Never accept client authoritative claims.
    return null;
  }
  if (record.contractVersion !== AVATAR_STRUCTURE_ANALYZER_CONTRACT_VERSION) return null;
  // Preview-only: re-derive is caller's job; we only accept non-authoritative copies for UX cache.
  if (typeof record.status !== 'string') return null;
  return {
    ...(record as unknown as AvatarStructureAnalysisResultV2),
    authoritative: false,
    contractVersion: AVATAR_STRUCTURE_ANALYZER_CONTRACT_VERSION,
  };
}

export function structureAnalysisCompatibleWithComposition(result: {
  anatomy: AvatarV2Anatomy;
  modularity: AvatarV2Modularity;
}): boolean {
  return (
    (AVATAR_V2_ANATOMIES as readonly string[]).includes(result.anatomy) &&
    (AVATAR_V2_MODULARITIES as readonly string[]).includes(result.modularity)
  );
}

export { MODULAR_AVATAR_GLB_CONTRACT_VERSION };

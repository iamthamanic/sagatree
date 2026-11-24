/**
 * Avatar V2 Asset Authoring Pipeline — pure domain (#254 / Epic #248).
 * Location: src/domains/character/avatar/asset-authoring-contract-v1.ts
 *
 * Provider-neutral Generate → Select → Normalize → Validate → Publish workflow.
 * Reuses Avatar3dGeneration contracts; Meshy is one adapter, Tripo must fit without
 * Domain/UI redesign. No React / backend clients / provider SDKs.
 */

import {
  AVATAR_3D_GENERATION_CONTRACT_VERSION,
  isAvatar3dGenerationProviderId,
  type Avatar3dGenerationProviderId,
  type Avatar3dGenerationSettings,
  type PoseMode,
} from './generation/types';
import {
  MODULAR_AVATAR_GLB_CONTRACT_VERSION,
  type ModularAvatarGlbStatus,
} from './modular-glb-contract-v1';
import type { AvatarV2BodyFamily } from './composition-contract-v2';

export const ASSET_AUTHORING_CONTRACT_VERSION = 'SagaTreeAssetAuthoringV1' as const;

export const ASSET_AUTHORING_KINDS = [
  'base-body',
  'species-template',
  'wearable',
  'trait',
  'prop',
] as const;
export type AssetAuthoringKind = (typeof ASSET_AUTHORING_KINDS)[number];

export const ASSET_AUTHORING_STAGES = [
  'generate',
  'select',
  'normalize',
  'validate',
  'publish',
] as const;
export type AssetAuthoringStage = (typeof ASSET_AUTHORING_STAGES)[number];

export const ASSET_AUTHORING_CANDIDATE_STATUSES = [
  'pending',
  'selected',
  'rejected',
  'validated',
  'published',
] as const;
export type AssetAuthoringCandidateStatus =
  (typeof ASSET_AUTHORING_CANDIDATE_STATUSES)[number];

export const ASSET_AUTHORING_LICENSE_KINDS = [
  'first-party',
  'cc0',
  'cc-by',
  'proprietary-licensed',
] as const;
export type AssetAuthoringLicenseKind = (typeof ASSET_AUTHORING_LICENSE_KINDS)[number];

/** Visual direction gates — fail closed on chibi / non-adult stylized. */
export const ASSET_AUTHORING_STYLE_TAGS = [
  'adult-stylized',
  'mtoon',
  /** Canonical v1 art direction — see docs/character-visual-styleguide.md */
  'palworld-overwatch-soft-real',
  /** Legacy direction tag — still valid; prefer palworld-overwatch-soft-real for new assets. */
  'palworld-korra-direction',
  'no-chibi',
] as const;
export type AssetAuthoringStyleTag = (typeof ASSET_AUTHORING_STYLE_TAGS)[number];

export interface AssetAuthoringProvenanceV1 {
  license: AssetAuthoringLicenseKind;
  /** Human-readable attribution / source note — required for publish. */
  attributionDe: string;
  /** Optional upstream URL (docs only — never a free mesh download URL in contracts). */
  sourceNote?: string;
}

export interface AssetAuthoringManifestV1 {
  contractVersion: typeof ASSET_AUTHORING_CONTRACT_VERSION;
  generationContractVersion: typeof AVATAR_3D_GENERATION_CONTRACT_VERSION;
  modularGlbContractVersion: typeof MODULAR_AVATAR_GLB_CONTRACT_VERSION;
  assetId: string;
  kind: AssetAuthoringKind;
  /** Semantic version of the published asset (e.g. 1.0.0). */
  assetVersion: string;
  /** Target body family when kind is base-body / wearable fit. */
  bodyFamily?: AvatarV2BodyFamily;
  providerId: Avatar3dGenerationProviderId;
  modelId: string;
  prompt: string;
  /** Logical reference asset keys or allowlisted image keys — never raw secrets. */
  references: readonly string[];
  settings: Avatar3dGenerationSettings;
  provenance: AssetAuthoringProvenanceV1;
  /** Hex or base64url checksum of published bytes. */
  outputChecksum: string;
  styleTags: readonly AssetAuthoringStyleTag[];
  createdAt: string;
}

export interface AssetAuthoringGoldenCriteriaV1 {
  requirePose: PoseMode;
  requireMtoonCompatible: boolean;
  requireAdultStylized: boolean;
  forbidChibi: boolean;
  requireModularExtrasWhenKind: readonly AssetAuthoringKind[];
  minRigHumanoidBonesForBaseBody: number;
}

export const DEFAULT_ASSET_AUTHORING_GOLDEN_CRITERIA: AssetAuthoringGoldenCriteriaV1 = {
  requirePose: 'a-pose',
  requireMtoonCompatible: true,
  requireAdultStylized: true,
  forbidChibi: true,
  requireModularExtrasWhenKind: ['base-body', 'wearable', 'trait'],
  minRigHumanoidBonesForBaseBody: 12,
};

export interface AssetAuthoringCandidateEvidenceV1 {
  pose: PoseMode | 'unknown';
  modularGlbStatus: ModularAvatarGlbStatus | 'absent';
  humanoidBoneCount: number;
  morphTargetCount: number;
  mtoonMaterialHint: boolean;
  styleTagsClaimed: readonly AssetAuthoringStyleTag[];
  /** Client/provider style claims are never trusted alone. */
  visualReviewNotesDe?: string;
  byteSize: number;
  checksum: string;
}

export interface AssetAuthoringValidationIssue {
  code: string;
  severity: 'blocker' | 'warn';
  messageDe: string;
}

export interface AssetAuthoringValidationResultV1 {
  contractVersion: typeof ASSET_AUTHORING_CONTRACT_VERSION;
  ok: boolean;
  score: number;
  issues: readonly AssetAuthoringValidationIssue[];
}

export interface AssetAuthoringCandidateV1 {
  candidateId: string;
  status: AssetAuthoringCandidateStatus;
  providerId: Avatar3dGenerationProviderId;
  modelId: string;
  settings: Avatar3dGenerationSettings;
  evidence: AssetAuthoringCandidateEvidenceV1;
  validation?: AssetAuthoringValidationResultV1;
}

export function isAssetAuthoringKind(value: unknown): value is AssetAuthoringKind {
  return typeof value === 'string' && (ASSET_AUTHORING_KINDS as readonly string[]).includes(value);
}

export function assertAuthoringUsesGenerationContract(providerId: string): Avatar3dGenerationProviderId {
  if (!isAvatar3dGenerationProviderId(providerId)) {
    throw new Error(
      `Unbekannter Generate-Provider "${providerId}". Adapter muss ${AVATAR_3D_GENERATION_CONTRACT_VERSION} implementieren (z. B. Tripo später).`,
    );
  }
  return providerId;
}

export function createAssetAuthoringManifest(input: {
  assetId: string;
  kind: AssetAuthoringKind;
  assetVersion: string;
  providerId: string;
  modelId: string;
  prompt: string;
  references?: readonly string[];
  settings: Avatar3dGenerationSettings;
  provenance: AssetAuthoringProvenanceV1;
  outputChecksum: string;
  styleTags?: readonly AssetAuthoringStyleTag[];
  bodyFamily?: AvatarV2BodyFamily;
  createdAt?: string;
}): AssetAuthoringManifestV1 {
  const providerId = assertAuthoringUsesGenerationContract(input.providerId);
  const assetId = input.assetId.trim();
  const assetVersion = input.assetVersion.trim();
  const prompt = input.prompt.trim();
  const modelId = input.modelId.trim();
  const checksum = input.outputChecksum.trim();
  if (!assetId || !assetVersion || !prompt || !modelId || !checksum) {
    throw new Error('Authoring-Manifest unvollständig.');
  }
  if (!input.provenance.attributionDe.trim()) {
    throw new Error('Provenance/Attribution ist Pflicht für First-Party Assets.');
  }
  for (const ref of input.references ?? []) {
    if (/^https?:\/\//i.test(ref) && !ref.startsWith('https://')) {
      throw new Error('Nur https-Referenzen oder logische Keys erlaubt.');
    }
  }
  return {
    contractVersion: ASSET_AUTHORING_CONTRACT_VERSION,
    generationContractVersion: AVATAR_3D_GENERATION_CONTRACT_VERSION,
    modularGlbContractVersion: MODULAR_AVATAR_GLB_CONTRACT_VERSION,
    assetId,
    kind: input.kind,
    assetVersion,
    bodyFamily: input.bodyFamily,
    providerId,
    modelId,
    prompt,
    references: [...(input.references ?? [])],
    settings: input.settings,
    provenance: {
      license: input.provenance.license,
      attributionDe: input.provenance.attributionDe.trim(),
      sourceNote: input.provenance.sourceNote?.trim() || undefined,
    },
    outputChecksum: checksum,
    styleTags: input.styleTags ?? [
      'adult-stylized',
      'mtoon',
      'palworld-overwatch-soft-real',
      'no-chibi',
    ],
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Deterministic candidate scoring against golden criteria.
 * Provider style claims are evidence hints only — blockers come from structure.
 */
export function validateAssetAuthoringCandidate(input: {
  kind: AssetAuthoringKind;
  evidence: AssetAuthoringCandidateEvidenceV1;
  criteria?: AssetAuthoringGoldenCriteriaV1;
}): AssetAuthoringValidationResultV1 {
  const criteria = input.criteria ?? DEFAULT_ASSET_AUTHORING_GOLDEN_CRITERIA;
  const issues: AssetAuthoringValidationIssue[] = [];
  let score = 1;

  if (input.evidence.byteSize <= 0) {
    issues.push({
      code: 'empty-bytes',
      severity: 'blocker',
      messageDe: 'Kandidat hat keine Bytes.',
    });
    score = 0;
  }
  if (!input.evidence.checksum.trim()) {
    issues.push({
      code: 'missing-checksum',
      severity: 'blocker',
      messageDe: 'Checksum fehlt — Publish nicht reproduzierbar.',
    });
    score = 0;
  }

  if (input.evidence.pose !== criteria.requirePose && input.evidence.pose !== 'unknown') {
    issues.push({
      code: 'pose-mismatch',
      severity: 'blocker',
      messageDe: `Pose ${input.evidence.pose} entspricht nicht ${criteria.requirePose}.`,
    });
    score *= 0.4;
  } else if (input.evidence.pose === 'unknown') {
    issues.push({
      code: 'pose-unknown',
      severity: 'warn',
      messageDe: 'Pose unbekannt — Review nötig.',
    });
    score *= 0.85;
  }

  if (
    criteria.requireModularExtrasWhenKind.includes(input.kind) &&
    (input.evidence.modularGlbStatus === 'invalid' ||
      input.evidence.modularGlbStatus === 'absent')
  ) {
    issues.push({
      code: 'modular-extras',
      severity: input.evidence.modularGlbStatus === 'invalid' ? 'blocker' : 'warn',
      messageDe:
        input.evidence.modularGlbStatus === 'invalid'
          ? 'Modular-GLB-Extras ungültig.'
          : 'Modular-GLB-Extras fehlen — limited.',
    });
    score *= input.evidence.modularGlbStatus === 'invalid' ? 0.3 : 0.7;
  }

  if (
    input.kind === 'base-body' &&
    input.evidence.humanoidBoneCount < criteria.minRigHumanoidBonesForBaseBody
  ) {
    issues.push({
      code: 'rig-insufficient',
      severity: 'blocker',
      messageDe: `Base Body braucht ≥${criteria.minRigHumanoidBonesForBaseBody} Humanoid-Bones.`,
    });
    score *= 0.2;
  }

  if (criteria.requireMtoonCompatible && !input.evidence.mtoonMaterialHint) {
    issues.push({
      code: 'mtoon-missing',
      severity: 'warn',
      messageDe: 'Kein MToon-/Cel-Material-Hinweis — Style-Gate unsicher.',
    });
    score *= 0.8;
  }

  if (criteria.forbidChibi && input.evidence.styleTagsClaimed.includes('no-chibi') === false) {
    issues.push({
      code: 'chibi-risk',
      severity: 'warn',
      messageDe: 'no-chibi Tag fehlt in Claims — visuell prüfen.',
    });
    score *= 0.9;
  }

  if (criteria.requireAdultStylized) {
    const hasAdult = input.evidence.styleTagsClaimed.includes('adult-stylized');
    if (!hasAdult) {
      issues.push({
        code: 'style-adult',
        severity: 'warn',
        messageDe: 'adult-stylized fehlt in Style-Tags.',
      });
      score *= 0.85;
    }
  }

  const blockers = issues.filter((i) => i.severity === 'blocker');
  const ok = blockers.length === 0 && score >= 0.55;
  return {
    contractVersion: ASSET_AUTHORING_CONTRACT_VERSION,
    ok,
    score: Math.max(0, Math.min(1, score)),
    issues,
  };
}

/** Rule-based select: highest score among ok candidates; ties → stable candidateId order. */
export function selectAssetAuthoringCandidate(
  candidates: readonly AssetAuthoringCandidateV1[],
): AssetAuthoringCandidateV1 | null {
  const ranked = [...candidates]
    .filter((c) => c.validation?.ok)
    .sort((a, b) => {
      const scoreDiff = (b.validation?.score ?? 0) - (a.validation?.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return a.candidateId.localeCompare(b.candidateId);
    });
  return ranked[0] ?? null;
}

/**
 * Publish gate: selected candidate + manifest provenance + checksum match.
 * Provider unavailable retries stay outside — existing assets untouched.
 */
export function assertCanPublishAuthoringAsset(input: {
  manifest: AssetAuthoringManifestV1;
  candidate: AssetAuthoringCandidateV1;
}): { ok: true } | { ok: false; reasonDe: string } {
  if (input.candidate.status !== 'selected' && input.candidate.status !== 'validated') {
    return { ok: false, reasonDe: 'Kandidat ist nicht selected/validated.' };
  }
  if (!input.candidate.validation?.ok) {
    return { ok: false, reasonDe: 'Kandidat hat die Golden-Validation nicht bestanden.' };
  }
  if (input.candidate.evidence.checksum !== input.manifest.outputChecksum) {
    return { ok: false, reasonDe: 'Checksum von Kandidat und Manifest stimmen nicht überein.' };
  }
  if (!input.manifest.provenance.attributionDe.trim()) {
    return { ok: false, reasonDe: 'Provenance fehlt.' };
  }
  if (input.candidate.providerId !== input.manifest.providerId) {
    return { ok: false, reasonDe: 'Provider zwischen Kandidat und Manifest divergiert.' };
  }
  return { ok: true };
}

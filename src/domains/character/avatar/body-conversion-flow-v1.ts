/**
 * Avatar V2 Body Conversion Flow — pure domain (#263 / Epic #248).
 * Location: src/domains/character/avatar/body-conversion-flow-v1.ts
 *
 * Implements Identity Transfer Spike (#262) default/degraded pipelines for
 * optional Import → Standard/Compact/Heavy conversion. No React / Three / backend clients.
 */

import {
  createDefaultAvatarMorphState,
  type SagaTreeAvatarMorphStateV1,
} from './morph-contract';
import {
  buildIdentityTransferConversionPlan,
  resolveIdentityTransferDecision,
  type IdentityTransferApproachId,
} from './identity-transfer-v1';
import type {
  AvatarV2Anatomy,
  AvatarV2BodyFamily,
  AvatarV2Modularity,
} from './composition-contract-v2';
import type { CanonicalBodyFamilyId } from './canonical-body-families-v1';
import { isCanonicalBodyFamilyId } from './canonical-body-families-v1';

export const BODY_CONVERSION_FLOW_CONTRACT_VERSION =
  'SagaTreeBodyConversionFlowV1' as const;

export const BODY_CONVERSION_TARGET_FAMILIES = [
  'standard',
  'compact',
  'heavy',
] as const satisfies readonly CanonicalBodyFamilyId[];

export type BodyConversionTargetFamily = (typeof BODY_CONVERSION_TARGET_FAMILIES)[number];

export type BodyConversionStatus = 'ready' | 'degraded' | 'failed';

export interface BodyConversionFamilyOptionV1 {
  familyId: BodyConversionTargetFamily;
  labelDe: string;
  recommended: boolean;
  previewHintDe: string;
}

export interface BodyConversionRequestV1 {
  sourceArtifactId: string;
  sourceImportAssetId: string;
  sourceModelUrl: string;
  anatomy: AvatarV2Anatomy;
  modularity: AvatarV2Modularity;
  recommendedFamily: AvatarV2BodyFamily;
  /** Player-selected target; must be allowlisted. */
  targetFamily: BodyConversionTargetFamily;
  /** Optional identity fidelity estimate 0..1 from analysis heuristics. */
  identityFidelityEstimate?: number;
}

export interface BodyConversionResultV1 {
  contractVersion: typeof BODY_CONVERSION_FLOW_CONTRACT_VERSION;
  status: BodyConversionStatus;
  targetFamily: BodyConversionTargetFamily;
  approachIds: readonly IdentityTransferApproachId[];
  morphState: SagaTreeAvatarMorphStateV1;
  anatomy: 'humanoid';
  modularity: 'modular-parts';
  bodyCompatibility: BodyConversionTargetFamily;
  traits: {
    head: string;
    ears: string;
    hair: string;
    clothing: string;
    accessory: string;
  };
  colors: { hair: string; skin: string };
  tradeoffCopyDe: string;
  limitationsDe: readonly string[];
  /** Converted path uses catalog body — never the source mesh URL. */
  usesCanonicalBody: true;
  /** Source ids preserved for undo / re-activate original. */
  sourceArtifactId: string;
  sourceImportAssetId: string;
  sourceModelUrl: string;
}

const FAMILY_LABEL_DE: Record<BodyConversionTargetFamily, string> = {
  standard: 'Standard',
  compact: 'Compact',
  heavy: 'Heavy',
};

export function isBodyConversionTargetFamily(
  value: unknown,
): value is BodyConversionTargetFamily {
  return (
    typeof value === 'string' &&
    (BODY_CONVERSION_TARGET_FAMILIES as readonly string[]).includes(value)
  );
}

/**
 * Build picker options. Recommendation is a hint, never a lock.
 */
export function listBodyConversionFamilyOptions(input: {
  recommendedFamily: AvatarV2BodyFamily;
  anatomy: AvatarV2Anatomy;
}): readonly BodyConversionFamilyOptionV1[] {
  const recommended =
    isCanonicalBodyFamilyId(input.recommendedFamily)
      ? input.recommendedFamily
      : 'standard';
  const customWarn =
    input.anatomy === 'custom-creature'
      ? ' Humanoide Interpretation — Silhouette ändert sich deutlich.'
      : '';

  return BODY_CONVERSION_TARGET_FAMILIES.map((familyId) => ({
    familyId,
    labelDe: FAMILY_LABEL_DE[familyId],
    recommended: familyId === recommended,
    previewHintDe:
      (familyId === recommended ? 'Empfohlen · ' : '') +
      `Look wird übertragen; Proportionen passen sich ${FAMILY_LABEL_DE[familyId]} an.` +
      customWarn,
  }));
}

function morphApproxForFamily(
  family: BodyConversionTargetFamily,
): SagaTreeAvatarMorphStateV1 {
  const base = createDefaultAvatarMorphState();
  if (family === 'compact') {
    return {
      ...base,
      body: { ...base.body, height: -0.35, build: 0.25 },
    };
  }
  if (family === 'heavy') {
    return {
      ...base,
      body: { ...base.body, height: 0.15, build: 0.45 },
    };
  }
  return base;
}

function defaultTraitsForFamily(family: BodyConversionTargetFamily): BodyConversionResultV1['traits'] {
  if (family === 'compact') {
    return {
      head: 'human-balanced',
      ears: 'round',
      hair: 'short',
      clothing: 'casual',
      accessory: 'none',
    };
  }
  if (family === 'heavy') {
    return {
      head: 'human-balanced',
      ears: 'round',
      hair: 'short',
      clothing: 'casual',
      accessory: 'none',
    };
  }
  return {
    head: 'human-balanced',
    ears: 'round',
    hair: 'short',
    clothing: 'casual',
    accessory: 'none',
  };
}

/**
 * Pure conversion planner — implements spike default/degraded without inventing capabilities.
 */
export function planBodyConversion(
  request: BodyConversionRequestV1,
): BodyConversionResultV1 {
  const decision = resolveIdentityTransferDecision();
  const plan = buildIdentityTransferConversionPlan();

  if (!isBodyConversionTargetFamily(request.targetFamily)) {
    return failedResult(request, ['Ziel-Körper ist nicht erlaubt.']);
  }

  const fidelity =
    typeof request.identityFidelityEstimate === 'number'
      ? request.identityFidelityEstimate
      : request.anatomy === 'humanoid'
        ? 0.7
        : 0.45;

  const degraded =
    fidelity < decision.identityFidelityThreshold ||
    request.anatomy === 'custom-creature' ||
    request.anatomy === 'unknown';

  const approachIds = degraded
    ? decision.degradedFallbackApproachIds
    : decision.defaultApproachIds;

  const limitationsDe: string[] = [];
  if (request.anatomy === 'custom-creature') {
    limitationsDe.push(plan.customCreaturePolicyDe);
  }
  if (degraded) {
    limitationsDe.push(
      'Eingeschränkter Transfer: Morph/Proportion + Farben/Traits — ohne Texture-Bake.',
    );
  } else {
    limitationsDe.push(
      'Optionaler Texture-Bake ist in dieser Slice als Flag vorgesehen; Look folgt Morph + Traits/Materials.',
    );
  }

  return {
    contractVersion: BODY_CONVERSION_FLOW_CONTRACT_VERSION,
    status: degraded ? 'degraded' : 'ready',
    targetFamily: request.targetFamily,
    approachIds,
    morphState: morphApproxForFamily(request.targetFamily),
    anatomy: 'humanoid',
    modularity: 'modular-parts',
    bodyCompatibility: request.targetFamily,
    traits: defaultTraitsForFamily(request.targetFamily),
    colors: { hair: '#3f2a1d', skin: '#c58c6a' },
    tradeoffCopyDe:
      'Look wird auf den SagaTree-Körper übertragen. Proportionen können sich ändern — dafür volle Kleidung- und Körperbearbeitung der Family.',
    limitationsDe,
    usesCanonicalBody: true,
    sourceArtifactId: request.sourceArtifactId,
    sourceImportAssetId: request.sourceImportAssetId,
    sourceModelUrl: request.sourceModelUrl,
  };
}

function failedResult(
  request: BodyConversionRequestV1,
  limitationsDe: string[],
): BodyConversionResultV1 {
  return {
    contractVersion: BODY_CONVERSION_FLOW_CONTRACT_VERSION,
    status: 'failed',
    targetFamily: isBodyConversionTargetFamily(request.targetFamily)
      ? request.targetFamily
      : 'standard',
    approachIds: [],
    morphState: createDefaultAvatarMorphState(),
    anatomy: 'humanoid',
    modularity: 'modular-parts',
    bodyCompatibility: 'standard',
    traits: defaultTraitsForFamily('standard'),
    colors: { hair: '#3f2a1d', skin: '#c58c6a' },
    tradeoffCopyDe: 'Conversion fehlgeschlagen — Original bleibt unverändert.',
    limitationsDe,
    usesCanonicalBody: true,
    sourceArtifactId: request.sourceArtifactId,
    sourceImportAssetId: request.sourceImportAssetId,
    sourceModelUrl: request.sourceModelUrl,
  };
}

export function assertBodyConversionFlowInvariants(): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (BODY_CONVERSION_TARGET_FAMILIES.length !== 3) {
    issues.push('exactly 3 target families');
  }
  const opts = listBodyConversionFamilyOptions({
    recommendedFamily: 'compact',
    anatomy: 'humanoid',
  });
  if (!opts.some((o) => o.recommended && o.familyId === 'compact')) {
    issues.push('compact recommendation');
  }
  const ready = planBodyConversion({
    sourceArtifactId: 'a',
    sourceImportAssetId: 'i',
    sourceModelUrl: 'https://example.invalid/x',
    anatomy: 'humanoid',
    modularity: 'limited',
    recommendedFamily: 'compact',
    targetFamily: 'compact',
    identityFidelityEstimate: 0.75,
  });
  if (ready.status !== 'ready' || ready.targetFamily !== 'compact') {
    issues.push('humanoid ready compact');
  }
  if (!ready.usesCanonicalBody) issues.push('must use canonical body');
  const custom = planBodyConversion({
    sourceArtifactId: 'a',
    sourceImportAssetId: 'i',
    sourceModelUrl: 'https://example.invalid/x',
    anatomy: 'custom-creature',
    modularity: 'monolithic',
    recommendedFamily: 'custom',
    targetFamily: 'standard',
    identityFidelityEstimate: 0.4,
  });
  if (custom.status !== 'degraded') issues.push('custom → degraded');
  if (custom.anatomy !== 'humanoid') issues.push('conversion result humanoid');
  return { ok: issues.length === 0, issues };
}
